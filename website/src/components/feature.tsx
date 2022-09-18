// import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import { Feature } from "../lib/feature";

export const FeatureText = ({ title, points }: Feature) => (
  <div>
    <h3>{title}</h3>
    {points.map(({ title, body }) => (
      <div className="mt-10" key={title}>
        <h6 className="m-0">{title}</h6>
        <p className="body1 text-functionless-medium dark:text-functionless-dark-medium mt-2">
          {body}
        </p>
      </div>
    ))}
    {/* <div className="space-x-7 pt-5 flex items-center">
      <button className="solid-button">Read Docs</button>
      <button className="outline-button w-auto t">See Example</button>
    </div> */}
  </div>
);
