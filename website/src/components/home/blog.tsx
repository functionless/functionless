import Link from "@docusaurus/Link";
import { BlogPost } from "@docusaurus/plugin-content-blog";

export enum ChipColor {
  blue = "blue-chip",
  green = "green-chip",
  yellow = "yellow-chip",
  purple = "purple-chip",
}

const ChipColors: Record<string, string> = {
  Serverless: ChipColor.purple,
  functionless: ChipColor.blue,
};

export const Blog = ({
  post: {
    metadata: {
      tags,
      title,
      description,
      authors,
      date,
      readingTime,
      permalink,
    },
  },
}: {
  post: BlogPost;
}) => {
  return (
    <div className="col-span-3 md:col-span-1 my-4">
      <div className="flex gap-2">
        {tags.map(({ label, permalink }) => (
          <Link
            to={permalink}
            key={label}
            className={ChipColors[label] ?? ChipColor.purple}
          >
            {label}
          </Link>
        ))}
      </div>
      <h5 className="my-4">
        <Link to={permalink}>{title}</Link>
      </h5>
      <p className="my-4 body1 text-functionless-medium dark:text-functionless-dark-medium">
        {description}
      </p>
      <div className="flex space-x-4">
        <Link href={authors[0].url}>
          <img
            className="inline-block h-10 w-10 rounded-full bg-functionless-dark-border"
            src={authors[0].imageURL}
            alt={authors[0].name}
          />
        </Link>
        <div className="">
          <Link href={authors[0].url}>
            <div className="subtitle1">{authors[0].name}</div>
          </Link>
          <div className="body2 text-functionless-medium dark:text-functionless-dark-medium">
            {new Date(date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}{" "}
            · {readingTime} min read
          </div>
        </div>
      </div>
    </div>
  );
};
