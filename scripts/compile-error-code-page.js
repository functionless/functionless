const { ErrorCodes } = require("../lib/error-code");

const fs = require("fs");
const path = require("path");

/**
 * Generate `functionless.org/docs/error-codes file.
 */

const errorCodesAPIReference = path.join(
  __dirname,
  "..",
  "website",
  "docs",
  "api",
  "namespaces",
  "ErrorCodes.md"
);

const errorCodeDocumentationPath = path.join(
  __dirname,
  "..",
  "website",
  "docs",
  "error-codes.md"
);

let errorCodeMarkdown = fs
  .readFileSync(errorCodesAPIReference)
  .toString()
  .replace("## Variables\n", "# Error Codes\n")
  .replace(
    `id: "ErrorCodes"
title: "Namespace: ErrorCodes"
sidebar_label: "ErrorCodes"
sidebar_position: 0
custom_edit_url: null`,
    `title: "Error Codes"
sidebar_position: 3`
  )
  .replace(/• `Const`.*\n/g, "")
  .replace(/\n\n\n/g, "\n\n")
  .replace(/\n#### Defined in.*\n\n.*error.*\n/g, "")
  // re-write generated urls from link statements.
  .replace(/\.\.\//g, "api/");

for (const [errorId, errorCode] of Object.entries(ErrorCodes)) {
  //### Cannot\_perform\_arithmetic\_on\_variables\_in\_Step\_Function
  errorCodeMarkdown = errorCodeMarkdown.replace(
    `### ${errorId.replace(/_/g, "\\_")}`,
    `### ${errorCode.messageText}

__Error Code__: Functionless(${errorCode.code})`
  );
}

fs.writeFileSync(errorCodeDocumentationPath, errorCodeMarkdown);
