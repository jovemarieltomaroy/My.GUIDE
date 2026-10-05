import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import AppSidebar from "../components/AppSidebar";
import Icon from "../components/Icon";
import { API_BASE_URL, apiRequest } from "../config/api";
import { useAuth } from "../context/AuthContext";

export default function KnowledgeBasePage() {
  const navigate = useNavigate();
  const { user, clearUser } = useAuth();

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [resources, setResources] =
    useState([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isUploading, setIsUploading] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState("");

  const [pageError, setPageError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [searchInput, setSearchInput] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("");

  const [uploadModalOpen, setUploadModalOpen] =
    useState(false);

  const [selectedResource, setSelectedResource] =
    useState(null);

  const [detailsModalOpen, setDetailsModalOpen] =
    useState(false);

  const [form, setForm] = useState({
    title: "",
    resourceType: "reference",
    topic: "",
    file: null,
  });

  const handleUnauthorized =
    useCallback(() => {
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

    if (
      user.role !== "Counselor-Admin"
    ) {
      navigate("/dashboard", {
        replace: true,
      });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!successMessage) {
      return undefined;
    }

    const timer = window.setTimeout(
      () => {
        setSuccessMessage("");
      },
      4000,
    );

    return () =>
      window.clearTimeout(timer);
  }, [successMessage]);

  const fetchResources =
    useCallback(async () => {
      if (!user) return;

      setIsLoading(true);
      setPageError("");

      try {
        const data =
          await apiRequest(
            "/knowledge-base",
            {
              method: "GET",
            },
          );

        setResources(
          Array.isArray(data?.resources)
            ? data.resources
            : [],
        );
      } catch (error) {
        console.error(
          "Unable to retrieve knowledge resources:",
          error,
        );

        if (error.status === 401) {
          handleUnauthorized();
          return;
        }

        setPageError(
          error.message ||
            "Unable to retrieve knowledge resources.",
        );
      } finally {
        setIsLoading(false);
      }
    }, [
      user,
      handleUnauthorized,
    ]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const filteredResources =
    useMemo(() => {
      const query =
        searchInput
          .trim()
          .toLowerCase();

      return resources.filter(
        (resource) => {
          const matchesSearch =
            !query ||
            [
              resource.title,
              resource.originalFileName,
              resource.resourceType,
              resource.topic,
              resource.embeddingModel,
              resource.uploadedBy
                ?.firstName,
              resource.uploadedBy
                ?.lastName,
            ]
              .filter(Boolean)
              .some((value) =>
                String(value)
                  .toLowerCase()
                  .includes(query),
              );

          const matchesStatus =
            !statusFilter ||
            resource.processingStatus ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        },
      );
    }, [
      resources,
      searchInput,
      statusFilter,
    ]);

  const stats = useMemo(() => {
    return {
      total: resources.length,

      ready: resources.filter(
        (resource) =>
          resource.processingStatus ===
          "Ready",
      ).length,

      chunks: resources.reduce(
        (total, resource) =>
          total +
          Number(
            resource.totalChunks || 0,
          ),
        0,
      ),

      failed: resources.filter(
        (resource) =>
          resource.processingStatus ===
          "Failed",
      ).length,
    };
  }, [resources]);

  const resetUploadForm = () => {
    setForm({
      title: "",
      resourceType: "reference",
      topic: "",
      file: null,
    });
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
    formData.append(
      "resourceType",
      form.resourceType.trim(),
    );
    formData.append("topic", form.topic.trim());

    const data = await apiRequest(
      "/knowledge-base",
      {
        method: "POST",
        body: formData,
      },
    );

    // Immediately add the successfully processed
    // resource to the page.
    if (data?.resource?._id) {
      setResources((current) => {
        const alreadyExists = current.some(
          (resource) =>
            resource._id === data.resource._id,
        );

        if (alreadyExists) {
          return current.map((resource) =>
            resource._id === data.resource._id
              ? data.resource
              : resource,
          );
        }

        return [data.resource, ...current];
      });
    }

    setSuccessMessage(
      data?.message ||
        "Knowledge resource uploaded successfully.",
    );

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
        refreshError,
      );
    }
  } catch (error) {
    console.error(
      "Knowledge resource upload failed:",
      error,
    );

    if (error.status === 401) {
      handleUnauthorized();
      return;
    }

    setPageError(
      error.data?.error ||
        error.message ||
        "Unable to upload the knowledge resource.",
    );
  } finally {
    setIsUploading(false);
  }
};

  const viewResource =
    async (resourceId) => {
      setPageError("");

      try {
        const data =
          await apiRequest(
            `/knowledge-base/${resourceId}`,
            {
              method: "GET",
            },
          );

        setSelectedResource({
          ...data.resource,
          actualChunkCount:
            data.chunkCount,
        });

        setDetailsModalOpen(true);
      } catch (error) {
        if (error.status === 401) {
          handleUnauthorized();
          return;
        }

        setPageError(
          error.message ||
            "Unable to retrieve resource details.",
        );
      }
    };

  const deleteResource =
    async (resource) => {
      const confirmed =
        window.confirm(
          `Delete "${resource.title}"?\n\nThis will also delete all associated knowledge chunks and the uploaded PDF.`,
        );

      if (!confirmed) return;

      setDeletingId(resource._id);
      setPageError("");

      try {
        const data =
          await apiRequest(
            `/knowledge-base/${resource._id}`,
            {
              method: "DELETE",
            },
          );

        setResources(
          (current) =>
            current.filter(
              (item) =>
                item._id !==
                resource._id,
            ),
        );

        setSuccessMessage(
          data?.message ||
            "Knowledge resource deleted successfully.",
        );
      } catch (error) {
        if (error.status === 401) {
          handleUnauthorized();
          return;
        }

        setPageError(
          error.message ||
            "Unable to delete the knowledge resource.",
        );
      } finally {
        setDeletingId("");
      }
    };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F7F6F4] font-[Poppins] text-[#2F2A27]">
      <AppSidebar
        user={user}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={
          setSidebarOpen
        }
      />

      <div className="min-h-screen lg:pl-[220px]">
        <header className="sticky top-0 z-30 flex min-h-[62px] items-center border-b border-[#E6E1DE] bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-7">
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setSidebarOpen(true)
                }
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#E4DFDC] text-[#655E59] lg:hidden"
              >
                <Icon
                  name="menu"
                  className="h-4 w-4"
                />
              </button>

              <div>
                <h1 className="text-[20px] font-semibold">
                  Knowledge Base
                </h1>

                <p className="hidden text-[14px] text-[#99918C] sm:block">
                  Manage curated resources used by the LLM recommendation system
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setUploadModalOpen(
                  true,
                )
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#8C1518] px-3 text-[14px] font-semibold text-white transition hover:bg-[#701013]"
            >
              <Icon
                name="plus"
                className="h-3 w-3"
              />

              Upload PDF
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-7">
          {successMessage && (
            <Alert
              tone="success"
              message={
                successMessage
              }
            />
          )}

          {pageError && (
            <Alert
              tone="error"
              message={pageError}
            />
          )}

          <section>
            <h2 className="text-[27px] font-semibold tracking-[-0.03em]">
              RAG knowledge resources
            </h2>

            <p className="mt-1 max-w-[850px] text-[14px] leading-4 text-[#89817D]">
              Upload approved counseling references, worksheets, handouts, and other PDF resources. Uploaded documents are processed into searchable knowledge chunks for retrieval during LLM recommendation generation.
            </p>
          </section>

          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Resources"
              value={stats.total}
              description="Uploaded documents"
            />

            <StatCard
              label="Ready"
              value={stats.ready}
              description="Available for retrieval"
            />

            <StatCard
              label="Knowledge chunks"
              value={stats.chunks}
              description="Embedded text chunks"
            />

            <StatCard
              label="Failed"
              value={stats.failed}
              description="Resources needing attention"
            />
          </section>

          <section className="mt-5 overflow-hidden rounded-2xl border border-[#E4DFDC] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#ECE8E5] p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-[17px] font-semibold">
                  Resource library
                </h3>

                <p className="mt-1 text-[13px] text-[#938B86]">
                  {
                    filteredResources.length
                  }{" "}
                  resource
                  {filteredResources.length ===
                  1
                    ? ""
                    : "s"}{" "}
                  displayed
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
                    value={
                      searchInput
                    }
                    onChange={(
                      event,
                    ) =>
                      setSearchInput(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Search resources..."
                    className="h-8 w-full min-w-[220px] rounded-lg border border-[#E1DCD8] bg-[#FAF9F8] pl-8 pr-2.5 text-[14px] outline-none focus:border-[#8C1518]"
                  />
                </div>

                <select
                  value={
                    statusFilter
                  }
                  onChange={(
                    event,
                  ) =>
                    setStatusFilter(
                      event.target
                        .value,
                    )
                  }
                  className="h-8 rounded-lg border border-[#E1DCD8] bg-white px-2.5 text-[14px] outline-none focus:border-[#8C1518]"
                >
                  <option value="">
                    All statuses
                  </option>

                  <option value="Ready">
                    Ready
                  </option>

                  <option value="Processing">
                    Processing
                  </option>

                  <option value="Pending">
                    Pending
                  </option>

                  <option value="Failed">
                    Failed
                  </option>
                </select>
              </div>
            </div>

            {isLoading ? (
              <LoadingState />
            ) : filteredResources.length ===
              0 ? (
              <EmptyState
                onUpload={() =>
                  setUploadModalOpen(
                    true,
                  )
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#ECE8E5] bg-[#FCFBFA] text-left">
                      <TableHeader>
                        Resource
                      </TableHeader>

                      <TableHeader>
                        Type
                      </TableHeader>

                      <TableHeader>
                        Topic
                      </TableHeader>

                      <TableHeader>
                        Pages
                      </TableHeader>

                      <TableHeader>
                        Chunks
                      </TableHeader>

                      <TableHeader>
                        Status
                      </TableHeader>

                      <TableHeader>
                        Uploaded
                      </TableHeader>

                      <TableHeader>
                        Actions
                      </TableHeader>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredResources.map(
                      (resource) => (
                        <tr
                          key={
                            resource._id
                          }
                          className="border-b border-[#F0ECE9] last:border-b-0 hover:bg-[#FCFBFA]"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F4EAEA] text-[#8C1518]">
                                <Icon
                                  name="file"
                                  className="h-3.5 w-3.5"
                                />
                              </div>

                              <div className="min-w-0">
                                <p className="max-w-[240px] truncate text-[14px] font-semibold">
                                  {
                                    resource.title
                                  }
                                </p>

                                <p className="mt-1 max-w-[240px] truncate text-[13px] text-[#9A928D]">
                                  {
                                    resource.originalFileName
                                  }
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-[14px] capitalize text-[#625B57]">
                            {resource.resourceType ||
                              "—"}
                          </td>

                          <td className="px-4 py-3 text-[14px] text-[#625B57]">
                            {resource.topic ||
                              "—"}
                          </td>

                          <td className="px-4 py-3 text-[14px] text-[#625B57]">
                            {resource.totalPages ??
                              0}
                          </td>

                          <td className="px-4 py-3 text-[14px] text-[#625B57]">
                            {resource.totalChunks ??
                              0}
                          </td>

                          <td className="px-4 py-3">
                            <StatusBadge
                              status={
                                resource.processingStatus
                              }
                            />
                          </td>

                          <td className="px-4 py-3 text-[13px] text-[#827A76]">
                            {formatDate(
                              resource.createdAt,
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  viewResource(
                                    resource._id,
                                  )
                                }
                                className="h-7 rounded-lg border border-[#DCD6D2] bg-white px-2.5 text-[13px] font-semibold text-[#5A534F] hover:border-[#8C1518] hover:text-[#8C1518]"
                              >
                                View
                              </button>

                              <button
                                type="button"
                                disabled={
                                  deletingId ===
                                  resource._id
                                }
                                onClick={() =>
                                  deleteResource(
                                    resource,
                                  )
                                }
                                className="h-7 rounded-lg border border-red-200 bg-red-50 px-2.5 text-[13px] font-semibold text-red-600 disabled:opacity-50"
                              >
                                {deletingId ===
                                resource._id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>

      {uploadModalOpen && (
        <UploadModal
          form={form}
          setForm={setForm}
          uploading={
            isUploading
          }
          onClose={
            closeUploadModal
          }
          onSubmit={
            handleUpload
          }
        />
      )}

      {detailsModalOpen &&
        selectedResource && (
          <ResourceDetailsModal
            resource={
              selectedResource
            }
            onClose={() => {
              setDetailsModalOpen(
                false,
              );

              setSelectedResource(
                null,
              );
            }}
          />
        )}
    </div>
  );
}

function UploadModal({
  form,
  setForm,
  uploading,
  onClose,
  onSubmit,
}) {
  return (
    <ModalShell
      title="Upload knowledge resource"
      description="Add an approved PDF to the curated RAG knowledge base."
      onClose={onClose}
      disableClose={uploading}
    >
      <form
        onSubmit={onSubmit}
        className="space-y-4"
      >
        <Field
          label="Resource title"
          required
        >
          <input
            required
            value={form.title}
            onChange={(event) =>
              setForm(
                (current) => ({
                  ...current,
                  title:
                    event.target
                      .value,
                }),
              )
            }
            placeholder="e.g. Stress Management Guide"
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Resource type"
            required
          >
            <select
              required
              value={
                form.resourceType
              }
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    resourceType:
                      event.target
                        .value,
                  }),
                )
              }
              className={
                inputClass
              }
            >
              <option value="reference">
                Reference
              </option>

              <option value="worksheet">
                Worksheet
              </option>

              <option value="handout">
                Handout
              </option>

              <option value="activity">
                Activity
              </option>

              <option value="exercise">
                Exercise
              </option>

              <option value="template">
                Template
              </option>
            </select>
          </Field>

          <Field
            label="Topic"
            required
          >
            <input
              required
              value={
                form.topic
              }
              onChange={(event) =>
                setForm(
                  (current) => ({
                    ...current,
                    topic:
                      event.target
                        .value,
                  }),
                )
              }
              placeholder="e.g. Academic Stress"
              className={
                inputClass
              }
            />
          </Field>
        </div>

        <Field
          label="PDF file"
          required
        >
          <input
            required
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) =>
              setForm(
                (current) => ({
                  ...current,
                  file:
                    event.target
                      .files?.[0] ||
                    null,
                }),
              )
            }
            className="block w-full rounded-lg border border-[#DDD8D4] bg-white px-3 py-2 text-[14px] text-[#5E5753] file:mr-3 file:rounded-md file:border-0 file:bg-[#F4EAEA] file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-[#8C1518]"
          />
        </Field>

        {form.file && (
          <div className="rounded-xl border border-[#E5E0DD] bg-[#FAF9F8] p-3">
            <p className="text-[14px] font-semibold">
              {form.file.name}
            </p>

            <p className="mt-1 text-[13px] text-[#938B86]">
              {formatFileSize(
                form.file.size,
              )}
            </p>
          </div>
        )}

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] leading-4 text-amber-800">
          Uploading will extract the PDF text, create chunks, filter low-quality content, generate embeddings, and store the resulting knowledge chunks in MongoDB.
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

            {uploading
              ? "Processing..."
              : "Upload and process"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ResourceDetailsModal({
  resource,
  onClose,
}) {
  const [pdfUrl, setPdfUrl] =
    useState(null);

  const [pdfLoading, setPdfLoading] =
    useState(true);

  const [pdfError, setPdfError] =
    useState("");

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;

    const loadPdf = async () => {
      if (!resource?._id) {
        setPdfLoading(false);
        setPdfError(
          "This resource does not have a valid ID.",
        );
        return;
      }

      setPdfLoading(true);
      setPdfError("");

      try {
        const response = await fetch(
          `${API_BASE_URL}/knowledge-base/${resource._id}/pdf`,
          {
            method: "GET",
            credentials: "include",
          },
        );

        if (!response.ok) {
          let message =
            "Unable to load the PDF preview.";

          try {
            const errorData =
              await response.json();

            message =
              errorData?.message ||
              message;
          } catch {
            // The response was not JSON.
          }

          throw new Error(message);
        }

        const blob =
          await response.blob();

        if (cancelled) {
          return;
        }

        objectUrl =
          URL.createObjectURL(blob);

        setPdfUrl(objectUrl);
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Unable to load knowledge resource PDF:",
            error,
          );

          setPdfError(
            error.message ||
              "Unable to load the PDF preview.",
          );
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
        URL.revokeObjectURL(
          objectUrl,
        );
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
        <div>
          <div className="mb-2">
            <p className="text-[15px] font-semibold text-[#3B3330]">
              PDF Preview
            </p>

            <p className="mt-0.5 text-[14px] text-[#8B817C]">
              {resource.originalFileName ||
                "Uploaded knowledge resource"}
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#E7E1DD] bg-[#F8F6F4]">
            {pdfLoading && (
              <div className="flex h-[520px] items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-[#D8CECA] border-t-[#8C1518]" />

                  <p className="mt-3 text-[14px] text-[#7D736E]">
                    Loading PDF preview...
                  </p>
                </div>
              </div>
            )}

            {!pdfLoading &&
              pdfError && (
                <div className="flex h-[520px] items-center justify-center p-6">
                  <div className="max-w-xs text-center">
                    <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-red-50 text-red-700">
                      !
                    </div>

                    <p className="mt-3 text-[15px] font-semibold text-[#4B403B]">
                      PDF preview unavailable
                    </p>

                    <p className="mt-1 text-[14px] leading-4 text-[#8B817C]">
                      {pdfError}
                    </p>
                  </div>
                </div>
              )}

            {!pdfLoading &&
              !pdfError &&
              pdfUrl && (
                <iframe
                  src={pdfUrl}
                  title={`PDF preview - ${resource.title}`}
                  className="h-[520px] w-full bg-white"
                />
              )}
          </div>
        </div>

        {/* RESOURCE DETAILS */}
        <div>
          <div className="mb-2">
            <p className="text-[15px] font-semibold text-[#3B3330]">
              Resource Information
            </p>

            <p className="mt-0.5 text-[14px] text-[#8B817C]">
              Stored metadata and processing details.
            </p>
          </div>

          <div className="grid gap-3">
            <DetailCard
              label="Title"
              value={resource.title}
            />

            <div className="grid grid-cols-2 gap-3">
              <DetailCard
                label="Status"
                value={
                  resource.processingStatus
                }
              />

              <DetailCard
                label="Resource type"
                value={
                  resource.resourceType
                }
              />
            </div>

            <DetailCard
              label="Topic"
              value={resource.topic}
            />

            <div className="grid grid-cols-2 gap-3">
              <DetailCard
                label="Pages"
                value={
                  resource.totalPages ??
                  0
                }
              />

              <DetailCard
                label="Stored chunks"
                value={
                  resource.actualChunkCount ??
                  resource.totalChunks ??
                  0
                }
              />
            </div>

            <DetailCard
              label="Original file"
              value={
                resource.originalFileName
              }
            />

            <div className="grid grid-cols-2 gap-3">
              <DetailCard
                label="Embedding provider"
                value={
                  resource.embeddingProvider
                }
              />

              <DetailCard
                label="Embedding model"
                value={
                  resource.embeddingModel
                }
              />
            </div>

            <DetailCard
              label="Uploaded by"
              value={formatUserName(
                resource.uploadedBy,
              )}
            />

            <DetailCard
              label="Uploaded"
              value={formatDateTime(
                resource.createdAt,
              )}
            />

            <DetailCard
              label="Last updated"
              value={formatDateTime(
                resource.updatedAt,
              )}
            />
          </div>

          {resource.processingError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-red-700">
                Processing error
              </p>

              <p className="mt-1 text-[14px] leading-4 text-red-700">
                {
                  resource.processingError
                }
              </p>
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

function ModalShell({
  title,
  description,
  children,
  onClose,
  disableClose = false,
  wide = false,
}) {
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
          wide
            ? "max-w-[1200px]"
            : "max-w-[700px]"
        }`}
      >
        <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-[#ECE8E5] bg-white px-5 py-4">
          <div>
            <h2 className="text-[20px] font-semibold">
              {title}
            </h2>

            <p className="mt-1 text-[14px] text-[#938B86]">
              {description}
            </p>
          </div>

          <button
            type="button"
            disabled={disableClose}
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#8C847F] transition hover:bg-[#F4F1EF] disabled:opacity-40"
          >
            <Icon
              name="close"
              className="h-3.5 w-3.5"
            />
          </button>
        </header>

        <div className="p-5">
          {children}
        </div>
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
          isSuccess
            ? "bg-emerald-100"
            : "bg-red-100"
        }`}
      >
        <span className="text-[15px] font-bold">
          {isSuccess ? "✓" : "!"}
        </span>
      </div>

      <div className="min-w-0">
        <p className="text-[14px] font-semibold">
          {isSuccess ? "Success" : "Error"}
        </p>

        <p className="mt-0.5 text-[14px] leading-4">
          {message}
        </p>
      </div>
    </div>
  );
}
function StatCard({
  label,
  value,
  description,
}) {
  return (
    <article className="rounded-2xl border border-[#E5E0DD] bg-white p-4">
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#958D88]">
        {label}
      </p>

      <p className="mt-2 text-[20px] font-semibold tracking-[-0.04em] text-[#342F2C]">
        {value}
      </p>

      <p className="mt-1 text-[13px] text-[#99918C]">
        {description}
      </p>
    </article>
  );
}

function TableHeader({
  children,
}) {
  return (
    <th className="px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.07em] text-[#8E8681]">
      {children}
    </th>
  );
}

function StatusBadge({
  status,
}) {
  const styles = {
    Ready:
      "bg-emerald-50 text-emerald-700",
    Processing:
      "bg-blue-50 text-blue-700",
    Pending:
      "bg-amber-50 text-amber-700",
    Failed:
      "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[13px] font-medium ${
        styles[status] ||
        "bg-[#F1EEEC] text-[#6E6763]"
      }`}
    >
      {status ||
        "Unknown"}
    </span>
  );
}

function Field({
  label,
  required = false,
  children,
}) {
  return (
    <label className="block">
      <span className="text-[14px] font-semibold text-[#4B4541]">
        {label}

        {required && (
          <span className="ml-1 text-red-600">
            *
          </span>
        )}
      </span>

      <div className="mt-1.5">
        {children}
      </div>
    </label>
  );
}

function DetailCard({
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-[#E8E3E0] bg-[#FCFBFA] p-3">
      <p className="text-[13px] text-[#958D88]">
        {label}
      </p>

      <p className="mt-1 break-words text-[14px] font-semibold text-[#4E4844]">
        {value || "—"}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid min-h-[380px] place-items-center">
      <div className="text-center">
        <span className="mx-auto block h-7 w-7 animate-spin rounded-full border-2 border-[#8C1518]/20 border-t-[#8C1518]" />

        <p className="mt-3 text-[14px] text-[#827B77]">
          Loading knowledge resources...
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  onUpload,
}) {
  return (
    <div className="grid min-h-[380px] place-items-center px-6 text-center">
      <div>
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#F4EAEA] text-[#8C1518]">
          <Icon
            name="file"
            className="h-5 w-5"
          />
        </div>

        <p className="mt-4 text-[16px] font-semibold">
          No knowledge resources yet
        </p>

        <p className="mt-1 max-w-[380px] text-[14px] leading-4 text-[#938C87]">
          Upload the first approved PDF to begin building the curated RAG knowledge base.
        </p>

        <button
          type="button"
          onClick={onUpload}
          className="mt-4 h-8 rounded-lg bg-[#8C1518] px-4 text-[14px] font-semibold text-white"
        >
          Upload first PDF
        </button>
      </div>
    </div>
  );
}

function formatUserName(
  user,
) {
  if (!user) {
    return "Unknown";
  }

  return [
    user.firstName,
    user.lastName,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatDate(value) {
  if (!value) return "—";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      dateStyle: "medium",
    },
  ).format(date);
}

function formatDateTime(
  value,
) {
  if (!value) return "—";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

function formatFileSize(
  bytes,
) {
  if (
    !Number.isFinite(bytes) ||
    bytes <= 0
  ) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ];

  const unitIndex =
    Math.min(
      Math.floor(
        Math.log(bytes) /
          Math.log(1024),
      ),
      units.length - 1,
    );

  const value =
    bytes /
    1024 ** unitIndex;

  return `${value.toFixed(
    value >= 10 ||
      unitIndex === 0
      ? 0
      : 1,
  )} ${units[unitIndex]}`;
}

const inputClass =
  "h-9 w-full rounded-lg border border-[#DDD8D4] bg-white px-3 text-[14px] font-[Poppins] text-[#302B28] outline-none transition placeholder:text-[#AAA39F] focus:border-[#8C1518] focus:ring-2 focus:ring-[#8C1518]/[0.06]";