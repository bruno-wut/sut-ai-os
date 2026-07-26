import { getCollection } from "astro:content";

const newsFiles = import.meta.glob("../content/news/**/*.md");

export const hasNewsPosts = Object.keys(newsFiles).length > 0;

export async function getNewsPosts() {
  if (!hasNewsPosts) return [];

  return (await getCollection("news")).sort(
    (a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf()
  );
}
