export enum ChipColor {
  blue = "blue-chip",
  green = "green-chip",
  yellow = "yellow-chip",
  purple = "purple-chip",
}

type Props = {
  chip?: string;
  chipColor?: ChipColor;
  title?: string;
  desc?: string;
  avatar?: string;
  name?: string;
  date?: Date;
  readTime?: number;
};

export const Blog = ({
  chip = "Serverless",
  chipColor = ChipColor.blue,
  title = "Functionless > Serverless",
  desc = "Catch bugs before they occur and enjoy Intellisense in your IDE with type-safety that works across service boundaries.",
  avatar = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
  name = "Sam Sussman",
  date = new Date(),
  readTime = 12,
}: Props) => {
  return (
    <div className="">
      <div className="">
        <span className={chipColor}>{chip}</span>
        <h6 className="m-0 mt-4">{title}</h6>
        <p className="mt-2 body1 text-functionless-medium dark:text-functionless-dark-medium">
          {desc}
        </p>
        <div className="flex space-x-4">
          <img
            className="inline-block h-10 w-10 rounded-full"
            src={avatar}
            alt={name}
          />
          <div className="">
            <div className="subtitle1">{name}</div>
            <div className="body2 text-functionless-medium dark:text-functionless-dark-medium">
              {date.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}{" "}
              · {readTime} min read
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
