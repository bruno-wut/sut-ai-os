const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      ...init.headers
    }
  });

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-origin": "*"
    }
  });
}

export async function onRequestPost({ request, env }) {
  const expectedToken = env.CMS_UPLOAD_SECRET;
  const suppliedToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!expectedToken || suppliedToken !== expectedToken) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!env.CF_ACCOUNT_ID || !env.CF_IMAGES_API_TOKEN || !env.CF_IMAGES_ACCOUNT_HASH) {
    return json({ error: "Cloudflare Images upload environment is not configured" }, { status: 500 });
  }

  const payload = await request.json().catch(() => ({}));
  const fileName = typeof payload.fileName === "string" ? payload.fileName.slice(0, 180) : "news-cover";
  const metadata = JSON.stringify({
    source: "sri-u-thong-news-cms",
    fileName
  });

  const formData = new FormData();
  formData.append("requireSignedURLs", "false");
  formData.append("metadata", metadata);

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/images/v2/direct_upload`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CF_IMAGES_API_TOKEN}`
      },
      body: formData
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    return json({ error: "Cloudflare Images direct upload failed", details: result.errors ?? [] }, { status: 502 });
  }

  return json({
    id: result.result.id,
    uploadURL: result.result.uploadURL,
    deliveryURL: `https://imagedelivery.net/${env.CF_IMAGES_ACCOUNT_HASH}/${result.result.id}/public`
  });
}
