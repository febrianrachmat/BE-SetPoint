export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  meta: {
    timestamp: string;
    path: string;
    requestId: string;
  };
};

export type ApiErrorResponse = {
  success: false;
  error: {
    statusCode: number;
    code: string;
    message: string;
    details?: string[] | Record<string, unknown>;
  };
  meta: {
    timestamp: string;
    path: string;
    requestId: string;
  };
};
