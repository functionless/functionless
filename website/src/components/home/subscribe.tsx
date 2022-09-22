import { useLocation } from "@docusaurus/router";
import {
  button,
  description,
  emailPlaceholder,
  title,
} from "@site/src/content/home/subscribe";

import clsx from "clsx";
import ky from "ky";
import { useCallback, useRef, useState } from "react";

enum HubSpotTypeId {
  SingleLineText = "0-1",
}

enum LoadingState {
  idle,
  loading,
  complete,
  error,
}

export const Subscribe = () => {
  const emailField = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<LoadingState>(LoadingState.idle);
  const location = useLocation();

  const subscribe = useCallback(async () => {
    setState(LoadingState.loading);
    try {
      await ky.post(
        "https://api.hsforms.com/submissions/v3/integration/submit/22084824/9e8475ef-7968-4cdf-ab9d-cf1377216fef",
        {
          json: {
            fields: {
              name: "email",
              value: emailField.current?.value,
              objectTypeId: HubSpotTypeId.SingleLineText,
            },
            context: {
              pageName: "Sign Up",
              pageUri: location.pathname,
            },
          },
        }
      );
      setState(LoadingState.complete);
    } catch (e) {
      setState(LoadingState.error);
    }
  }, [location, emailField]);

  return (
    <section className="scroll-snap-point container code-gradient p-0.5 round shadow-light dark:shadow-dark my-36">
      <div className="round bg-functionless-white dark:bg-functionless-code">
        <div className="grid grid-cols-1 md:grid-cols-2  gap-12 md:gap-28 items-center p-10">
          <div>
            <h4 className="mb-4">{title}</h4>
            <p className="body1 text-functionless-medium dark:text-functionless-dark-medium">
              {description}
            </p>
          </div>

          {state !== LoadingState.complete && (
            <div className="relative">
              <input
                ref={emailField}
                type="text"
                placeholder={emailPlaceholder}
                className="px-6 py-18 h-14 rounded-full"
                disabled={state === LoadingState.loading}
              />
              <div className="absolute inset-y-1 right-1">
                <button
                  className={clsx(
                    "solid-button-small",
                    state === LoadingState.loading && "animate-pulse"
                  )}
                  onClick={subscribe}
                  disabled={state === LoadingState.loading}
                >
                  {button}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
