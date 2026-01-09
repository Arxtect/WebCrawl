import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import { LightpandaView } from "./views/LightpandaView";
import { WebCrawlView } from "./views/WebCrawlView";
import { NotFoundView } from "./views/NotFoundView";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <WebCrawlView /> },
      { path: "lightpanda", element: <LightpandaView /> },
    ],
  },
  { path: "*", element: <NotFoundView /> },
]);
