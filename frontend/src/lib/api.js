// Small fetch wrapper that attaches the JWT and unwraps { data, error }.
export function api(path, { method = "GET", body } = {}) {
  const token = localStorage.getItem("pp360_token");
  return fetch("/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).then(async (res) => {
    const json = await res.json().catch(() => ({ data: null, error: { message: "Bad response" } }));
    if (!res.ok) throw new Error(json.error?.message || "Request failed");
    return json.data;
  });
}