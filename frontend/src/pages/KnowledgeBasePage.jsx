import { clickableRecordProps } from "../utils/clickableRecord";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import AppSidebar from "../components/AppSidebar";
import Icon from "../components/Icon";
import { API_BASE_URL, apiRequest } from "../config/api";
import { useAuth } from "../context/AuthContext";

const RESOURCE_TYPES = ["reference", "worksheet", "handout"];
const typeLabel = (type) =>
  ({ reference: "Reference (RAG)", worksheet: "Worksheet", handout: "Handout" })[type] ||
  "Legacy type — review needed";
const RESOURCE_STATUSES = ["Active", "Under Review", "Obsolete"];
const resourceStatus = (resource) => resource.status || "Active";

export default function KnowledgeBasePage() {
  const navigate = useNavigate();
  const { user, clearUser } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [resources, setResources] = useState([]);

  const [isLoading, setIsLoading] = useState(true);

  const [isUploading, setIsUploading] = useState(false);

  const isAdmin = user?.role === "Counselor-Admin";
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editingResource, setEditingResource] = useState(null);
  const [replacementResource, setReplacementResource] = useState(null);

  const [pageError, setPageError] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  const [searchInput, setSearchInput] = useState("");

  const [statusFilter, setStatusFilter] = useState("");

  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const [selectedResource, setSelectedResource] = useState(null);

  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const [form, setForm] = useState({
    title: "",
    resourceType: "reference",
    topic: "",
    file: null,
    status: "Active",
    publicationYear: "",
    author: "",
    description: "",
  });

  const handleUnauthorized = useCallback(() => {
    clearUser();
    navigate("/login", {
      replace: true,
    });
  }, [clearUser, navigate]);

  useEffect(() => {
    if (!user) {
      navigate("/login", {
        replace: true,
      });

      return;
    }

    if (!["Counselor-Admin", "Counselor-User"].includes(user.role)) {
      navigate("/dashboard", {
        replace: true,
      });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setSuccessMessage("");
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const fetchResources = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setPageError("");

    try {
      const data = await apiRequest("/knowledge-base", {
        method: "GET",
      });

      setResources(Array.isArray(data?.resources) ? data.resources : []);
    } catch (error) {
      console.error("Unable to retrieve knowledge resources:", error);

      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      setPageError(error.message || "Unable to retrieve knowledge resources.");
    } finally {
      setIsLoading(false);
    }
  }, [user, handleUnauthorized]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const filteredResources = useMemo(() => {
    const query = searchInput.trim().toLowerCase();

    return resources.filter((resource) => {
      const matchesSearch =
        !query ||
        [
          resource.title,
          resource.originalFileName,
          resource.resourceType,
          resource.topic,
          resource.embeddingModel,
          resource.uploadedBy?.firstName,
          resource.uploadedBy?.lastName,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const matchesStatus = !statusFilter || resourceStatus(resource) === statusFilter;

      return (
        matchesSearch && matchesStatus && (!typeFilter || resource.resourceType === typeFilter)
      );
    });
  }, [resources, searchInput, statusFilter, typeFilter]);

  useEffect(() => setPage(1), [searchInput, statusFilter, typeFilter, resources.length]);
  const totalPages = Math.max(1, Math.ceil(filteredResources.length / 10));
  const currentPage = Math.min(page, totalPages);
  const displayedResources = filteredResources.slice((currentPage - 1) * 10, currentPage * 10);

  const stats = useMemo(() => {
    return {
      total: resources.length,

      active: resources.filter((resource) => resourceStatus(resource) === "Active").length,
      review: resources.filter((resource) => resourceStatus(resource) === "Under Review").length,
      obsolete: resources.filter((resource) => resourceStatus(resource) === "Obsolete").length,
    };
  }, [resources]);

  const resetUploadForm = () => {
    setForm({
      title: "",
      resourceType: "reference",
      topic: "",
      file: null,
      status: "Active",
      publicationYear: "",
      author: "",
      description: "",
    });
    setReplacementResource(null);
  };

  const closeUploadModal = () => {
    if (isUploading) return;

    setUploadModalOpen(false);
    resetUploadForm();
  };

  const handleUpload = async (event) => {
    event.preventDefault();

    if (!form.file) {
      setPageError("Please select a PDF file.");
      return;
    }

    setIsUploading(true);
    setPageError("");
    setSuccessMessage("");

    try {
      const formData = new FormData();

      formData.append("file", form.file);
      formData.append("title", form.title.trim());
      formData.append("resourceType", form.resourceType.trim());
      formData.append("topic", form.topic.trim());
      for (const field of ["status", "publicationYear", "author", "description"])
        formData.append(field, form[field] ?? "");

      const data = await apiRequest(
        replacementResource
          ? `/knowledge-base/${replacementResource._id}/replace`
          : "/knowledge-base",
        {
          method: "POST",
          body: formData,
        }
      );

      // Immediately add the successfully processed
      // resource to the page.
      if (data?.resource?._id) {
        setResources((current) => {
          const alreadyExists = current.some((resource) => resource._id === data.resource._id);

          if (alreadyExists) {
            return current.map((resource) =>
              resource._id === data.resource._id ? data.resource : resource
            );
          }

          return [data.resource, ...current];
        });
      }

      setSuccessMessage(data?.message || "Knowledge resource uploaded successfully.");

      setUploadModalOpen(false);
      resetUploadForm();

      // Synchronize with the backend afterward.
      // The UI no longer depends on this GET request
      // before showing the uploaded resource.
      try {
        await fetchResources();
      } catch (refreshError) {
        console.error(
          "Resource uploaded, but the resource list could not be refreshed:",
          refreshError
        );
      }
    } catch (error) {
      console.error("Knowledge resource upload failed:", error);

      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      setPageError(
        error.data?.error || error.message || "Unable to upload the knowledge resource."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const viewResource = async (resourceId) => {
    setPageError("");

    try {
      const data = await apiRequest(`/knowledge-base/${resourceId}`, {
        method: "GET",
      });

      setSelectedResource({
        ...data.resource,
        actualChunkCount: data.chunkCount,
      });

      setDetailsModalOpen(true);
    } catch (error) {
      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      setPageError(error.message || "Unable to retrieve resource details.");
    }
  };

  const saveResource = async (values, file) => {
    if (file) {
      const body = new FormData();
      body.append("file", file);
      for (const field of ["title", "topic", "resourceType", "status", "publicationYear", "author", "description"])
        body.append(field, values[field] ?? "");
      const data = await apiRequest(`/knowledge-base/${editingResource._id}/replace`, { method: "POST", body });
      setEditingResource(null);
      setSuccessMessage(data.message || "PDF replaced successfully.");
      await fetchResources();
      return;
    }
    const data = await apiRequest(`/knowledge-base/${editingResource._id}`, {
      method: "PATCH",
      body: JSON.stringify(values),
    });
    setResources((current) =>
      current.map((resource) => (resource._id === data.resource._id ? data.resource : resource))
    );
    setSuccessMessage(data.message);
    setEditingResource(null);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="authenticated-app min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#2F2A27]">
      <AppSidebar user={user} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="min-h-screen lg:pl-[250px]">
        <header className="sticky top-0 z-30 flex min-h-[62px] items-center border-b border-[#E6E1DE] bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-7">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#E4DFDC] text-[#655E59] lg:hidden"
              >
                <Icon name="menu" className="h-4 w-4" />
              </button>

              <div>
                <h1 className="text-[20px] font-semibold">Knowledge Base</h1>

                <p className="hidden text-[14px] text-[#99918C] sm:block">
                  Counseling resources and reference materials
                </p>
              </div>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setUploadModalOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 text-[14px] font-semibold text-white transition hover:bg-[#701013]"
              >
                <Icon name="plus" className="h-3 w-3" />
                Add Resource
              </button>
            )}
          </div>
        </header>

        <main className="page-content mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-7 lg:w-[calc(100%-240px)]! lg:px-0!">
          {successMessage && <Alert tone="success" message={successMessage} />}

          {pageError && <Alert tone="error" message={pageError} />}

          <section>
            <h2 className="text-[27px] font-semibold tracking-[-0.03em]">Knowledge resources</h2>

            <p className="mt-1 max-w-[850px] text-[14px] leading-4 text-[#89817D]">
              View counseling materials and manage their approval for new AI-assisted
              recommendations. Reference PDFs support recommendations; only permitted practical
              materials can be sent to students.
            </p>
          </section>

          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Resources"
              value={stats.total}
              description="Uploaded documents"
            />

            <StatCard
              label="Active Resources"
              value={stats.active}
              description="Approved resources; processing must be complete"
            />

            <StatCard
              label="Under Review Resources"
              value={stats.review}
              description="Excluded from new recommendations"
            />

            <StatCard
              label="Obsolete Resources"
              value={stats.obsolete}
              description="Retained for review and documentation"
            />
          </section>

          <section className="mt-5 overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#ECE8E5] p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-[17px] font-semibold">Resource library</h3>

                <p className="mt-1 text-[13px] text-[#938B86]">
                  {filteredResources.length} resource
                  {filteredResources.length === 1 ? "" : "s"} displayed
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Icon
                    name="search"
                    className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#AAA29D]"
                  />

                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search resources..."
                    className="h-8 w-full min-w-[220px] rounded-lg border border-[#E1DCD8] bg-[#FAF9F8] pl-8 pr-2.5 text-[14px] outline-none focus:border-[#8C1518]"
                  />
                </div>

                <select
                  aria-label="Resource type"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  className={inputClass}
                >
                  <option value="">All types</option>
                  {RESOURCE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {typeLabel(type)}
                    </option>
                  ))}
                </select>
                {isAdmin && (
                <select
                  aria-label="Resource status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-8 rounded-lg border border-[#E1DCD8] bg-white px-2.5 text-[14px] outline-none focus:border-[#8C1518]"
                >
                  <option value="">All statuses</option>

                  {RESOURCE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                )}
              </div>
            </div>

            {isLoading ? (
              <LoadingState />
            ) : filteredResources.length === 0 ? (
              <EmptyState onUpload={isAdmin ? () => setUploadModalOpen(true) : null} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#ECE8E5] bg-[#FCFBFA] text-left">
                      <TableHeader>Resource</TableHeader>

                      <TableHeader>Type</TableHeader>

                      <TableHeader>Topic</TableHeader>

                      <TableHeader>Pages</TableHeader>

                      <TableHeader>Status</TableHeader>

                      <TableHeader>Uploaded</TableHeader>

                      {isAdmin && <TableHeader>Actions</TableHeader>}
                    </tr>
                  </thead>

                  <tbody>
                    {displayedResources.map((resource) => (
                      <tr
                        {...clickableRecordProps(
                          () => viewResource(resource._id),
                          `Open ${resource.title}`
                        )}
                        key={resource._id}
                        className="clickable-record border-b border-[#F0ECE9] last:border-b-0 hover:bg-[#FCFBFA]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F4EAEA] text-[#8C1518]">
                              <Icon name="file" className="h-3.5 w-3.5" />
                            </div>

                            <div className="min-w-0">
                              <p className="max-w-[240px] truncate text-[14px] font-semibold">
                                {resource.title}
                              </p>

                              <p className="mt-1 max-w-[240px] truncate text-[13px] text-[#9A928D]">
                                {resource.originalFileName}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-[14px] capitalize text-[#625B57]">
                          {typeLabel(resource.resourceType)}
                        </td>

                        <td className="min-w-[300px] px-4 py-3 text-[14px] text-[#625B57] [overflow-wrap:normal]">
                          {resource.topic || "—"}
                        </td>

                        <td className="px-4 py-3 text-[14px] text-[#625B57]">
                          {resource.totalPages ?? 0}
                        </td>

                        <td className="px-4 py-3">
                          <StatusBadge status={resourceStatus(resource)} />
                          {(resource.isActive === false ||
                            resource.replacedBy ||
                            resource.replacementPending ||
                            resource.processingStatus !== "Ready") && (
                            <p className="mt-1.5 max-w-[150px] text-[12px] leading-4 text-[#827A76]">
                              {resource.isActive === false
                                ? "Access disabled"
                                : resource.replacedBy
                                  ? "Replaced by a newer version"
                                  : resource.replacementPending
                                    ? "Replacement in progress"
                                    : resource.processingStatus === "Failed"
                                      ? "PDF needs attention"
                                      : resource.processingStatus === "Processing"
                                        ? "Preparing PDF…"
                                        : "Awaiting processing"}
                            </p>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-[13px] text-[#827A76]">
                          {formatDate(resource.createdAt)}
                        </td>

                        {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setEditingResource(resource)}
                                  disabled={
                                    Boolean(resource.replacementPending) ||
                                    resource.processingStatus === "Processing"
                                  }
                                  className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-[#DCD6D2] bg-white px-3 text-[13px] font-semibold text-[#8C1518] transition-colors hover:border-[#8C1518] hover:bg-[#F4EAEA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8C1518] disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Edit
                                </button>

                              </>
                            )}
                          </div>
                        </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {filteredResources.length > 10 && (
              <div className="flex items-center justify-end gap-4 border-t border-[#ECE8E5] p-4 text-sm">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                  className="disabled:opacity-40"
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                  className="disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </section>
        </main>
      </div>

      {editingResource && (
        <EditResourceModal
          resource={editingResource}
          onSave={saveResource}
          onClose={() => setEditingResource(null)}
        />
      )}
      {uploadModalOpen && (
        <UploadModal
          replacement={replacementResource}
          form={form}
          setForm={setForm}
          uploading={isUploading}
          onClose={closeUploadModal}
          onSubmit={handleUpload}
        />
      )}

      {detailsModalOpen && selectedResource && (
        <ResourceDetailsModal
          resource={selectedResource}
          onClose={() => {
            setDetailsModalOpen(false);

            setSelectedResource(null);
          }}
        />
      )}
    </div>
  );
}

function UploadModal({ replacement, form, setForm, uploading, onClose, onSubmit }) {
  return (
    <ModalShell
      title={replacement ? "Replace resource" : "Add resource"}
      description={
        replacement
          ? "The previous PDF stays available. It becomes obsolete only after this approved replacement is processed successfully."
          : "Upload a counseling PDF and select its approval status."
      }
      onClose={onClose}
      disableClose={uploading}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Resource title" required>
          <AutoText
            required
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            placeholder="e.g. Stress Management Guide"
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Resource type" required>
            <select
              required
              disabled={Boolean(replacement)}
              value={form.resourceType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  resourceType: event.target.value,
                }))
              }
              className={inputClass}
            >
              <option value="reference">Reference (RAG)</option>

              <option value="worksheet">Worksheet</option>

              <option value="handout">Handout</option>
            </select>
          </Field>

          <Field label="Topic" required>
            <AutoText
              required
              value={form.topic}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  topic: event.target.value,
                }))
              }
              placeholder="e.g. Academic Stress"
              className={inputClass}
            />
          </Field>
        </div>

        <p className="text-[13px] leading-5 text-[#827A76]">
          Reference (RAG): supporting literature, never sent to students. Worksheet: tasks for
          students to complete. Handout: information for students to read. All three can support
          recommendations when Active.
        </p>
        <ResourceMetadataFields form={form} setForm={setForm} lockStatus={Boolean(replacement)} />
        <Field label="PDF file" required>
          <input
            required
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                file: event.target.files?.[0] || null,
              }))
            }
            className="block w-full rounded-lg border border-[#DDD8D4] bg-white px-3 py-2 text-[14px] text-[#5E5753] file:mr-3 file:rounded-md file:border-0 file:bg-[#F4EAEA] file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-[#8C1518]"
          />
        </Field>

        {form.file && (
          <div className="rounded-xl border border-[#E5E0DD] bg-[#FAF9F8] p-3">
            <p className="text-[14px] font-semibold">{form.file.name}</p>

            <p className="mt-1 text-[13px] text-[#938B86]">{formatFileSize(form.file.size)}</p>
          </div>
        )}

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-4 text-amber-800">
          The PDF will be prepared for searching. Only Active resources that finish processing can
          support new recommendations.
        </div>

        <div className="flex justify-end gap-2 border-t border-[#ECE8E5] pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="h-8 rounded-lg border border-[#DDD7D3] bg-white px-3 text-[14px] font-medium text-[#5E5753] disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={uploading}
            className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#8C1518] px-4 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {uploading && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}

            {uploading ? "Processing..." : "Upload and process"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ResourceDetailsModal({ resource, onClose }) {
  const [pdfUrl, setPdfUrl] = useState(null);

  const [pdfLoading, setPdfLoading] = useState(true);

  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;

    const loadPdf = async () => {
      if (!resource?._id) {
        setPdfLoading(false);
        setPdfError("This resource does not have a valid ID.");
        return;
      }

      setPdfLoading(true);
      setPdfError("");

      try {
        const response = await fetch(`${API_BASE_URL}/knowledge-base/${resource._id}/pdf`, {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          let message = "Unable to load the PDF preview.";

          try {
            const errorData = await response.json();

            message = errorData?.message || message;
          } catch {
            // The response was not JSON.
          }

          throw new Error(message);
        }

        const blob = await response.blob();

        if (cancelled) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);

        setPdfUrl(objectUrl);
      } catch (error) {
        if (!cancelled) {
          console.error("Unable to load knowledge resource PDF:", error);

          setPdfError(error.message || "Unable to load the PDF preview.");
        }
      } finally {
        if (!cancelled) {
          setPdfLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [resource?._id]);

  return (
    <ModalShell
      title="Knowledge resource"
      description="Preview the uploaded PDF and review its knowledge-base information."
      onClose={onClose}
      wide
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)]">
        {/* PDF PREVIEW */}
        <div className="flex min-w-0 flex-col self-stretch">
          <div className="mb-2">
            <p className="text-[15px] font-semibold text-[#3B3330]">PDF Preview</p>

            <p className="mt-0.5 text-[14px] text-[#8B817C]">
              {resource.originalFileName || "Uploaded knowledge resource"}
            </p>
          </div>

          <div className="relative min-h-[520px] overflow-hidden rounded-xl border border-[#E7E1DD] bg-[#F8F6F4] lg:flex-1">
            {pdfLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#D8CECA] border-t-[#8C1518]" />

                  <p className="mt-3 text-[14px] text-[#7D736E]">Loading PDF preview...</p>
                </div>
              </div>
            )}

            {!pdfLoading && pdfError && (
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="max-w-xs text-center">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-red-50 text-red-700">
                    !
                  </div>

                  <p className="mt-3 text-[15px] font-semibold text-[#4B403B]">
                    PDF preview unavailable
                  </p>

                  <p className="mt-1 text-[14px] leading-4 text-[#8B817C]">{pdfError}</p>
                </div>
              </div>
            )}

            {!pdfLoading && !pdfError && pdfUrl && (
              <iframe
                src={pdfUrl}
                title={`PDF preview - ${resource.title}`}
                className="absolute inset-0 h-full w-full border-0 bg-white"
              />
            )}
          </div>
        </div>

        {/* RESOURCE DETAILS */}
        <div>
          <div className="mb-2">
            <p className="text-[15px] font-semibold text-[#3B3330]">Resource Information</p>

            <p className="mt-0.5 text-[14px] text-[#8B817C]">
              Stored metadata and processing details.
            </p>
          </div>

          <div className="grid gap-3">
            <DetailCard label="Title" value={resource.title} />

            <div className="grid grid-cols-2 gap-3">
              <DetailCard label="Status" value={resourceStatus(resource)} />

              <DetailCard label="Resource type" value={typeLabel(resource.resourceType)} />
            </div>

            <DetailCard
              label="Student attachment"
              value={
                ["worksheet", "handout"].includes(resource.resourceType) &&
                resourceStatus(resource) === "Active" &&
                resource.isActive !== false &&
                resource.processingStatus === "Ready" &&
                !resource.replacedBy
                  ? "Eligible — counselor selection and plan approval required"
                  : resource.resourceType === "reference"
                    ? "Not permitted - Reference PDFs are supporting knowledge only"
                    : "Not eligible - review resource type, status, and processing"
              }
            />
            <DetailCard label="Publication year" value={resource.publicationYear} />
            <DetailCard label="Author or organization" value={resource.author} />
            <DetailCard label="Description" value={resource.description} />
            <div className="grid grid-cols-2 gap-3">
              <DetailCard label="Last reviewed" value={formatDateTime(resource.lastReviewedAt)} />
              <DetailCard label="Processing" value={resource.processingStatus} />
            </div>

            {resource.replaces && (
              <DetailCard label="Replaces resource" value={resource.replaces} />
            )}
            {resource.replacedBy && (
              <DetailCard label="Replaced by resource" value={resource.replacedBy} />
            )}
            {(resource.statusHistory || []).length > 0 && (
              <div className="rounded-xl border border-[#E8E3E0] p-3">
                <h3 className="text-sm font-semibold">Review history</h3>
                {resource.statusHistory.map((item, index) => (
                  <p key={index} className="mt-2 text-xs">
                    {item.previousStatus || "Uploaded"} → {item.newStatus} ·{" "}
                    {formatDateTime(item.changedAt)}
                    {item.reason ? ` · ${item.reason}` : ""}
                  </p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <DetailCard label="Topic" value={resource.topic} />
              <DetailCard label="Pages" value={resource.totalPages ?? 0} />
            </div>

            <DetailCard label="Original file" value={resource.originalFileName} />

            <DetailCard label="Uploaded by" value={formatUserName(resource.uploadedBy)} />

            <DetailCard label="Uploaded" value={formatDateTime(resource.createdAt)} />

            <DetailCard label="Last updated" value={formatDateTime(resource.updatedAt)} />
          </div>

          {resource.processingError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-red-700">
                Processing error
              </p>

              <p className="mt-1 text-[14px] leading-4 text-red-700">{resource.processingError}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex justify-end border-t border-[#ECE8E5] pt-4">
        <button
          type="button"
          onClick={onClose}
          className="h-8 rounded-lg bg-[#8C1518] px-4 text-[14px] font-semibold text-white transition hover:bg-[#741114]"
        >
          Close
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, description, children, onClose, disableClose = false, wide = false }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0"
        onClick={() => {
          if (!disableClose) {
            onClose();
          }
        }}
        aria-label="Close modal"
      />

      <section
        className={`relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-[#E2DDDA] bg-white shadow-[0_24px_80px_rgba(30,20,18,0.25)] ${
          wide ? "max-w-[1200px]" : "max-w-[700px]"
        }`}
      >
        <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-[#ECE8E5] bg-white px-5 py-4">
          <div>
            <h2 className="text-[20px] font-semibold">{title}</h2>

            <p className="mt-1 text-[14px] text-[#938B86]">{description}</p>
          </div>

          <button
            type="button"
            disabled={disableClose}
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#8C847F] transition hover:bg-[#F4F1EF] disabled:opacity-40"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}
function Alert({ tone = "success", message }) {
  const isSuccess = tone === "success";

  return (
    <div
      className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      <div
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
          isSuccess ? "bg-emerald-100" : "bg-red-100"
        }`}
      >
        <span className="text-[15px] font-bold">{isSuccess ? "✓" : "!"}</span>
      </div>

      <div className="min-w-0">
        <p className="text-[14px] font-semibold">{isSuccess ? "Success" : "Error"}</p>

        <p className="mt-0.5 text-[14px] leading-4">{message}</p>
      </div>
    </div>
  );
}
function StatCard({ label, value, description }) {
  return (
    <article className="rounded-2xl border border-[#E5E0DD] bg-white p-4">
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
        {label}
      </p>

      <p className="mt-2 text-[20px] font-semibold tracking-[-0.04em] text-[#342F2C]">{value}</p>

      <p className="mt-1 text-[13px] text-[#99918C]">{description}</p>
    </article>
  );
}

function TableHeader({ children }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.07em] text-[#8E8681]">
      {children}
    </th>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Active: "bg-emerald-50 text-emerald-700",
    "Under Review": "bg-amber-50 text-amber-700",
    Obsolete: "bg-slate-100 text-slate-600",
    Ready: "bg-emerald-50 text-emerald-700",
    Processing: "bg-blue-50 text-blue-700",
    Pending: "bg-amber-50 text-amber-700",
    Failed: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-current/10 px-2 py-0.5 text-[12px] font-medium leading-5 ${
        styles[status] || "bg-[#F1EEEC] text-[#6E6763]"
      }`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {status || "Unknown"}
    </span>
  );
}

function Field({ label, required = false, children }) {
  return (
    <label className="block">
      <span className="text-[14px] font-semibold text-[#4B4541]">
        {label}

        {required && <span className="ml-1 text-red-600">*</span>}
      </span>

      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function DetailCard({ label, value }) {
  return (
    <div className="rounded-xl border border-[#E8E3E0] bg-[#FCFBFA] p-3">
      <p className="text-[13px] text-[#958D88]">{label}</p>

      <p className="mt-1 break-words text-[14px] font-semibold text-[#4E4844]">{value || "—"}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-[380px] place-items-center">
      <div className="text-center">
        <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-[#8C1518]/20 border-t-[#8C1518]" />

        <p className="mt-3 text-[14px] text-[#827B77]">Loading knowledge resources...</p>
      </div>
    </div>
  );
}

function EmptyState({ onUpload }) {
  return (
    <div className="grid min-h-[380px] place-items-center px-6 text-center">
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#F4EAEA] text-[#8C1518]">
          <Icon name="file" className="h-5 w-5" />
        </div>

        <p className="mt-4 text-[16px] font-semibold">No matching resources</p>

        <p className="mt-1 max-w-[380px] text-[14px] leading-4 text-[#938C87]">
          Try another search or filter. Authorized administrators can add resources to the library.
        </p>

        {onUpload && (
          <button
            type="button"
            onClick={onUpload}
            className="mt-4 h-8 rounded-lg bg-[#8C1518] px-4 text-[14px] font-semibold text-white"
          >
            Upload first PDF
          </button>
        )}
      </div>
    </div>
  );
}

function formatUserName(user) {
  if (!user) {
    return "Unknown";
  }

  return [user.firstName, user.lastName].filter(Boolean).join(" ");
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];

  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);

  const value = bytes / 1024 ** unitIndex;

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

const inputClass =
  "h-9 w-full rounded-lg border border-[#DDD8D4] bg-white px-3 text-[14px] font-[Poppins] text-[#302B28] outline-none transition placeholder:text-[#AAA39F] focus:border-[#8C1518] focus:ring-2 focus:ring-[#8C1518]/[0.06]";
function ResourceMetadataFields({ form, setForm, lockStatus = false }) {
  const update = (event) =>
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Resource status">
          <select
            name="status"
            value={form.status}
            onChange={update}
            disabled={lockStatus}
            className={inputClass}
          >
            {RESOURCE_STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </Field>
        <Field label="Publication year">
          <input
            type="number"
            name="publicationYear"
            min="1000"
            max="9999"
            step="1"
            value={form.publicationYear}
            onChange={update}
            className={inputClass}
          />
        </Field>
      </div>
      <p className="text-[13px] text-[#827A76]">
        Active resources may support new recommendations when processing is complete. Under Review
        and Obsolete resources remain available for review.
      </p>
      <Field label="Author or organization (optional)">
        <AutoText name="author" value={form.author} onChange={update} className={inputClass} />
      </Field>
      <Field label="Description (optional)">
        <AutoText
          name="description"
          value={form.description}
          onChange={update}
          rows={3}
          className={inputClass}
        />
      </Field>
    </div>
  );
}

function EditResourceModal({ resource, onSave, onClose }) {
  const [form, setForm] = useState({
    title: resource.title,
    topic: resource.topic,
    resourceType: resource.resourceType,
    status: resourceStatus(resource),
    publicationYear: resource.publicationYear || "",
    author: resource.author || "",
    description: resource.description || "",
    reason: "",
  });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave(form, file);
    } catch (failure) {
      setError(failure.message || "Unable to update resource.");
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };
  const submit = (event) => {
    event.preventDefault();
    if (form.status !== resourceStatus(resource) && ["Active", "Obsolete"].includes(form.status))
      setConfirming(true);
    else save();
  };
  return (
    <ModalShell
      title={
        confirming
          ? form.status === "Obsolete"
            ? "Mark this resource as obsolete?"
            : "Reactivate this resource?"
          : "Edit resource"
      }
      wide
      description="Edit resource details or optionally replace the current PDF."
      onClose={onClose}
      disableClose={saving}
    >
      {error && <Alert tone="error" message={error} />}
      {confirming ? (
        <div className="space-y-5">
          <p className="text-sm leading-7">
            {form.status === "Obsolete"
              ? "This resource will no longer be used to generate new AI intervention recommendations. Its PDF and information will remain available in the Knowledge Base for reference and documentation."
              : "This resource will be eligible for new AI recommendations when it is ready and otherwise permitted. Its resource type and student attachment restrictions still apply."}
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => setConfirming(false)}
              className="rounded-lg border px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="rounded-lg bg-[#8C1518] px-4 py-2 text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : form.status === "Obsolete" ? "Mark as Obsolete" : "Reactivate"}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Resource title" required>
            <AutoText
              required
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              className={inputClass}
            />
          </Field>
          <Field label="Resource type">
            <select
              value={form.resourceType}
              onChange={(event) =>
                setForm((current) => ({ ...current, resourceType: event.target.value }))
              }
              className={inputClass}
            >
              {!RESOURCE_TYPES.includes(resource.resourceType) && (
                <option value={resource.resourceType} disabled>
                  Legacy type — review needed
                </option>
              )}
              {RESOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {typeLabel(type)}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-[13px] leading-5 text-[#827A76]">
            Reference (RAG) supports recommendations and is never attachable. Worksheets contain
            student tasks; Handouts provide reading information. Review legacy content before
            choosing its new type.
          </p>
          <Field label="Topic" required>
            <AutoText
              required
              value={form.topic}
              onChange={(event) =>
                setForm((current) => ({ ...current, topic: event.target.value }))
              }
              className={inputClass}
            />
          </Field>
          <ResourceMetadataFields form={form} setForm={setForm} />
          <Field label="Review reason (optional)">
            <AutoText
              value={form.reason}
              onChange={(event) =>
                setForm((current) => ({ ...current, reason: event.target.value }))
              }
              className={inputClass}
            />
          </Field>
          <CurrentResourcePdf resource={resource} file={file} setFile={setFile} disabled={saving} />
          {file && (form.resourceType !== resource.resourceType || form.status !== "Active") && (
            <p role="alert" className="text-sm text-red-800">PDF replacements require Active status and the original resource type. Save detail changes separately if needed.</p>
          )}
          <div className="sticky bottom-0 flex justify-end gap-3 border-t border-stone-200 bg-white py-4">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-lg border px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || Boolean(file && (form.resourceType !== resource.resourceType || form.status !== "Active"))}
              className="rounded-lg bg-[#8C1518] px-4 py-2 text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

function AutoText({ className = inputClass, value, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const resize = () => {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight + 2}px`;
    };
    let previousWidth = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== previousWidth) {
        previousWidth = element.clientWidth;
        resize();
      }
    });
    observer.observe(element);
    resize();
    return () => observer.disconnect();
  }, [value]);
  return <textarea {...props} ref={ref} value={value} rows={1} className={`${className} min-h-9 resize-none overflow-hidden py-2 leading-6`} />;
}

function CurrentResourcePdf({ resource, file, setFile, disabled }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    let objectUrl;
    fetch(`${API_BASE_URL}/knowledge-base/${resource._id}/pdf`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to preview the current PDF.");
        objectUrl = URL.createObjectURL(await response.blob());
        if (!cancelled) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((failure) => { if (!cancelled) setError(failure.message); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [resource._id]);
  return (
    <section className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Current PDF</h3>
          <p className="break-words text-sm text-stone-600">{resource.originalFileName}</p>
        </div>
        <button type="button" disabled={disabled || Boolean(resource.replacedBy) || resource.isActive === false} onClick={() => inputRef.current.click()} className="shrink-0 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-[#8C1518] disabled:opacity-50">Replace</button>
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      </div>
      {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : url ? <iframe title="Current resource PDF" src={url} className="h-[420px] w-full rounded-lg border border-stone-200 bg-white" /> : <p role="status" className="text-sm">Loading current PDF…</p>}
      {file && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm"><p className="break-words">Replacement: {file.name}</p><button type="button" disabled={disabled} onClick={() => { setFile(null); inputRef.current.value = ""; }} className="text-[#8C1518] underline">Keep current PDF</button></div>}
      <p className="text-sm text-stone-600">Replacing the PDF is optional. The previous PDF stays available and becomes obsolete after the replacement is processed successfully.</p>
    </section>
  );
}
