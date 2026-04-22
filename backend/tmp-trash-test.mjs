const email = `test-trash.${Date.now()}@example.com`;
const base = "http://localhost:5000";
const reg = await fetch(`${base}/api/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "TrashTest",
    email,
    password: "Password123!",
    department: "General",
  }),
});
const {
  data: { token },
} = await reg.json();
const hdr = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

const m1 = await (
  await fetch(`${base}/api/memos`, {
    method: "POST",
    headers: hdr,
    body: JSON.stringify({
      title: "Memo1",
      body: "body1",
      visibility: "public",
    }),
  })
).json();
const m2 = await (
  await fetch(`${base}/api/memos`, {
    method: "POST",
    headers: hdr,
    body: JSON.stringify({
      title: "Memo2",
      body: "body2",
      visibility: "public",
    }),
  })
).json();
const id1 = m1.data.memo.id;
const id2 = m2.data.memo.id;
console.log("Created:", id1, id2);

const del1 = await (
  await fetch(`${base}/api/memos/${id1}`, {
    method: "PUT",
    headers: hdr,
    body: JSON.stringify({ status: "deleted" }),
  })
).json();
const del2 = await (
  await fetch(`${base}/api/memos/${id2}`, {
    method: "PUT",
    headers: hdr,
    body: JSON.stringify({ status: "deleted" }),
  })
).json();
console.log("Del1 status:", del1.data?.memo?.status);
console.log("Del2 status:", del2.data?.memo?.status);

const restore = await (
  await fetch(`${base}/api/memos/${id1}`, {
    method: "PUT",
    headers: hdr,
    body: JSON.stringify({ status: "sent" }),
  })
).json();
console.log("Restored id1 status:", restore.data?.memo?.status);

const all = await (await fetch(`${base}/api/memos`, { headers: hdr })).json();
const deleted = all.data.memos.filter((m) => m.status === "deleted");
const sent = all.data.memos.filter((m) => m.status === "sent");
console.log(
  "Deleted memos after restore:",
  deleted.length,
  deleted.map((m) => m.title),
);
console.log(
  "Sent memos:",
  sent.map((m) => m.title),
);
