export interface AppModule {
  name: string;
  mountPoint: string;
  auth?: boolean;
  routes: APIRoutes[];
  modelName?: string;
}

export interface RequestSchemas {
  tags: string[];
  summary: string;
  description: string;
  schema?: {
    querystring: {};
  };
  body?: {
    title: string;
    type: string;
    additionalProperties: boolean;
    required: string[];
    properties: any;
  };
  consumes?: string[];
  response?: any;
}

export interface APIRoutes {
  method: string;
  url: string;
  auth?: boolean;
  modelName?: string;
  label?: string;
  schema: RequestSchemas;
  permission?: string[];
  handler: (request: any, reply: any) => Promise<any>;
}
