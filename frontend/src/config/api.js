export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export async function apiRequest(endpoint, options = {}) {
  const isFormData = options.body instanceof FormData;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,

    credentials: "include",

    headers: {
      ...(!isFormData && {
        "Content-Type": "application/json",
      }),

      ...options.headers,
    },
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(data?.message || `Request failed with status ${response.status}.`);

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}
