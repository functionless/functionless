import useIsBrowser from "@docusaurus/useIsBrowser";
import {
  button,
  description,
  emailPlaceholder,
  title,
  errorMessage,
  successMessage,
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
  const pageUri = useIsBrowser() ? location.href : "http://localhost";

  const subscribe = useCallback(async () => {
    setState(LoadingState.loading);
    try {
      await ky.post(
        "https://api.hsforms.com/submissions/v3/integration/submit/22084824/9e8475ef-7968-4cdf-ab9d-cf1377216fef",
        {
          json: {
            fields: [
              {
                name: "email",
                value: emailField.current?.value,
                objectTypeId: HubSpotTypeId.SingleLineText,
              },
              //TODO trash these once they are no longer mandatory on the backing form
              {
                name: "firstName",
                value: "N/A",
                objectTypeId: HubSpotTypeId.SingleLineText,
              },
              {
                name: "lastName",
                value: "N/A",
                objectTypeId: HubSpotTypeId.SingleLineText,
              },
            ],
            context: {
              pageName: "Sign Up",
              pageUri: pageUri,
            },
          },
        }
      );
      setState(LoadingState.complete);
    } catch (e) {
      setState(LoadingState.error);
    }
  }, [pageUri, emailField]);

  return (
    <section className="tw-container my-24 md:my-36">
      <div className="code-gradient p-0.5 round shadow-light dark:shadow-dark">
        <div className="round bg-functionless-white dark:bg-functionless-code">
          <div className="grid grid-cols-1 md:grid-cols-2  gap-12 lg:gap-28 items-start p-10">
            <div>
              <h4 className="mb-4">{title}</h4>
              <p className="body1 text-functionless-medium dark:text-functionless-dark-medium">
                {description}
              </p>
            </div>

            {state !== LoadingState.complete ? (
              <div className="relative mt-4">
                <input
                  ref={emailField}
                  type="email"
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
                {state === LoadingState.error && (
                  <div className="text-functionless-yellow mt-2 text-center">
                    {errorMessage}
                  </div>
                )}
              </div>
            ) : (
              <div className="relative mt-8 text-functionless-blue text-lg font-semibold">
                {successMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
