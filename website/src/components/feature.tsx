interface Props {
  image?: string;
  title?: string;
  desc?: string;
}

export const Feature = ({
  image = "/img/shapes/7.svg",
  title = "Unified Cloud Components",
  desc = "Cloud Resources have both a runtime and deployment-time API that is traditionally considered separate. Smart Cloud Resources unify these two surface areas to enable composable, higher-order abstractions for the cloud.",
}: Props) => {
  return (
    <div className="flex flex-col items-center">
      <img src={image} className="w-16" />
      <h6 className="mt-6 text-center">{title}</h6>
      <p className="text-center body1 text-functionless-medium dark:text-functionless-dark-medium">
        {desc}
      </p>
    </div>
  );
};
