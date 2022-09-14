export const Subscribe = () => {
  return (
    <div className="code-gradient p-0.5 round">
      <div className="round bg-functionless-white dark:bg-functionless-code">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-28 items-center p-10">
          <div>
            <h4>Subscribe for updates</h4>
            <p className="body1 text-functionless-medium dark:text-functionless-dark-medium">
              Get weekly articles in your inbox on tips and tricks to apply
              Functionless in your engineering pipeline.
            </p>
          </div>
          <div>
            <div className="relative">
              <input
                type="text"
                placeholder="Enter email address"
                className="px-6 py-18 h-14 rounded-full"
              />
              <div className="absolute inset-y-1 right-1">
                <button className="solid-button-small">Subscribe</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
