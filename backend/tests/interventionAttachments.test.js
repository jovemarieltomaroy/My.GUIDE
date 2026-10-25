const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const nodemailer = require("nodemailer");

test("knowledge-base worksheet becomes an actual PDF MIME attachment", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "guide-attachment-"));
  const filePath = path.join(directory, "worksheet.pdf");
  const pdf = Buffer.from("%PDF-1.4\nWorksheet fixture\n%%EOF");
  fs.writeFileSync(filePath, pdf);
  let stored = {
    isActive: true,
    processingStatus: "Ready",
    resourceType: "worksheet",
    filePath,
    originalFileName: "Worksheet.pdf",
  };
  const validationContext = {
    module: { exports: {} },
    require: (name) =>
      name === "../models/knowledgeResource"
        ? { findById: async () => stored }
        : name === "./resourceEligibility"
          ? require("../services/resourceEligibility")
          : require(name),
  };
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../services/knowledgeAttachments"), "utf8"),
    validationContext
  );
  const ctx = {
    module: { exports: {} },
    process,
    require: (name) =>
      name === "./knowledgeAttachments" ? validationContext.module.exports : require(name),
  };
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../services/interventionAttachments"), "utf8"),
    ctx
  );
  const resolve = (resources) =>
    ctx.module.exports.resolveInterventionAttachments(resources, {
      user: { _id: "counselor", role: "Counselor-User" },
    });
  const resource = {
    title: "Worksheet",
    type: "PDF",
    url: "/api/knowledge-base/012345678901234567890123/pdf",
  };
  try {
    const attachments = await resolve([resource]);
    assert.equal(attachments[0].filename, "Worksheet.pdf");
    assert.equal(attachments[0].resource, resource);
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const result = await transport.sendMail({
      from: "test@example.com",
      to: "student@example.com",
      subject: "Test",
      text: "Worksheet",
      attachments: attachments.map(({ filename, path }) => ({ filename, path })),
    });
    const mime = result.message.toString();
    assert.match(mime, /Content-Type: application\/pdf/);
    assert.match(mime, /Content-Disposition: attachment; filename=Worksheet.pdf/);
    assert.ok(mime.includes(pdf.toString("base64")));
    for (const overrides of [
      { resourceType: "reference" },
      { resourceType: "activity" },
      { resourceType: "exercise" },
      { resourceType: "template" },
      { status: "Obsolete" },
      { status: "Under Review" },
      { processingStatus: "Failed" },
    ]) {
      const active = stored;
      stored = { ...active, ...overrides };
      await assert.rejects(resolve([resource]), /cannot be attached|unavailable/);
      stored = active;
    }
    stored.resourceType = "handout";
    assert.equal((await resolve([resource])).length, 1);
    await assert.rejects(
      ctx.module.exports.resolveInterventionAttachments([resource]),
      /Not authorized/
    );
    stored.resourceType = "reference";
    await assert.rejects(resolve([{ ...resource, type: "Link" }]), /cannot be attached/);
    await assert.rejects(
      resolve([{ ...resource, url: "/uploads/knowledge-resources/reference.pdf" }]),
      /Invalid Knowledge Base/
    );
    stored = null;
    await assert.rejects(resolve([resource]), /cannot be attached|unavailable/);
    stored = { isActive: false, filePath };
    await assert.rejects(resolve([resource]), /cannot be attached|unavailable/);
    stored = { isActive: true, filePath: path.join(directory, "missing.pdf") };
    await assert.rejects(resolve([resource]), /cannot be attached|unavailable/);
    await assert.rejects(
      resolve([{ ...resource, url: "/uploads/../secret.pdf" }]),
      /cannot be attached|unavailable/
    );
    assert.equal((await resolve([{ type: "Link", url: "https://example.com" }])).length, 0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
