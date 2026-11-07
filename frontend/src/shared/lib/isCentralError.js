// Network and server failures have one notification area; field validation stays inline.
export const isCentralError = error => Boolean(error?.networkFailure || error?.status >= 500)
