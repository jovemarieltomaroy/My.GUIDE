const { test } = require("node:test");
const assert = require("node:assert/strict");
const router = require("../routes/bookingRoutes");

// Exercise actual router dispatch, including middleware ordering, without a DB or email.
const dispatch = (method, url) => new Promise((resolve, reject) => {
  const headers = {};
  const req = { method, url, originalUrl: url, headers: {}, cookies: {}, body: {}, ip: "127.0.0.1" };
  const res = {
    statusCode: 200,
    set(name, value) { headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { resolve({ status: this.statusCode, body, headers }); return this; },
  };
  router.handle(req, res, error => error ? reject(error) : reject(new Error("Route was not handled")));
});

for (const action of ["request", "verify", "confirm"]) {
  test(`public student-identity/${action} validates input without a login token`, async () => {
    const response = await dispatch("POST", `/public/student-identity/${action}`);
    assert.equal(response.status, 400);
    assert.equal(response.body.message, "Enter a valid student ID number.");
    assert.equal(response.headers["Cache-Control"], "no-store");
  });
}

test("private booking routes still require a login token", async () => {
  const response = await dispatch("GET", "/intakes");
  assert.equal(response.status, 401);
  assert.equal(response.body.message, "No token provided");
});
