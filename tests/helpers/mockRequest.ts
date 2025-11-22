/**
 * Mock Request objects for testing API routes
 */

export interface MockRequestOptions {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
  cookies?: Record<string, string>;
}

/**
 * Create a mock Next.js Request object
 */
export function mockRequest(options: MockRequestOptions = {}): Request {
  const {
    method = "GET",
    url = "http://localhost:3000/api/test",
    headers = {},
    body,
    cookies = {},
  } = options;

  // Build headers
  const headersList = new Headers(headers);

  // Add cookie header if cookies provided
  if (Object.keys(cookies).length > 0) {
    const cookieString = Object.entries(cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
    headersList.set("cookie", cookieString);
  }

  // Create request init
  const init: RequestInit = {
    method,
    headers: headersList,
  };

  // Add body if provided (for POST, PATCH, PUT)
  if (body && method !== "GET" && method !== "HEAD") {
    // Handle FormData separately - don't JSON stringify it
    if (body instanceof FormData) {
      init.body = body;
      // Don't set content-type for FormData - browser/fetch will set it automatically
    } else {
      init.body = JSON.stringify(body);
      headersList.set("content-type", "application/json");
    }
  }

  return new Request(url, init);
}

/**
 * Create a mock Request with Bearer token authentication
 */
export function mockBearerRequest(
  token: string,
  options: MockRequestOptions = {}
): Request {
  return mockRequest({
    ...options,
    headers: {
      ...(options.headers || {}),
      authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Create a mock Request with cookie authentication
 */
export function mockCookieRequest(
  accessToken: string,
  options: Omit<MockRequestOptions, "cookies"> = {}
): Request {
  return mockRequest({
    ...options,
    cookies: {
      __test_access: accessToken,
      ...options.cookies,
    },
  });
}

/**
 * Create a mock Request with valid origin for CSRF testing
 */
export function mockValidOriginRequest(
  options: MockRequestOptions = {}
): Request {
  return mockRequest({
    ...options,
    headers: {
      origin: "http://localhost:3000",
      ...options.headers,
    },
  });
}

/**
 * Create a mock Request with invalid origin for CSRF testing
 */
export function mockInvalidOriginRequest(
  options: MockRequestOptions = {}
): Request {
  return mockRequest({
    ...options,
    headers: {
      origin: "http://evil.com",
      ...options.headers,
    },
  });
}
