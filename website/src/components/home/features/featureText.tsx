import type { Feature } from "../../../lib/feature";

export const FeatureText = ({ title, points }: Feature) => (
  <div>
    <h4>{title}</h4>
    {points.map(({ title, body }) => (
      <div className="mt-10" key={title}>
        <h5 className="m-0">{title}</h5>
        <p className="body1 text-functionless-medium dark:text-functionless-dark-medium mt-2">
          {body}
        </p>
      </div>
    ))}
  </div>
);
