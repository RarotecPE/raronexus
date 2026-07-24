"use client";

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export function SwaggerClient() {
  return (
    <div className="swagger-shell">
      <SwaggerUI url="/api/v1/openapi" />
    </div>
  );
}
