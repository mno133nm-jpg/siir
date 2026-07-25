export async function searchJobs(keyword = "AI Engineer", location = "Saudi Arabia") {

  const response = await fetch(
    `https://jooble.org/api/${process.env.JOOBLE_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        keywords: keyword,
        location: location
      })
    }
  );

  const text = await response.text();

  console.log("Jooble Response:");
  console.log(text);

  if (!response.ok) {
    throw new Error(`Jooble API Error (${response.status}): ${text}`);
  }

  let data;

  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error("Jooble لم يرجع JSON صالح:\n" + text);
  }

  return (data.jobs || []).map(job => ({
    id: job.id || "",
    title: job.title || "بدون عنوان",
    company: job.company || "غير معروف",
    location: job.location || location,
    applyUrl: job.link || job.url || ""
  }));

}