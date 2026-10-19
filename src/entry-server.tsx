import { renderToString } from "react-dom/server"
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from "react-router"
import { routes } from "./app/routes"

const staticHandler = createStaticHandler(routes)

export async function render(request: Request) {
  const context = await staticHandler.query(request)

  if (context instanceof Response) {
    return { response: context }
  }

  const router = createStaticRouter(staticHandler.dataRoutes, context)
  const html = renderToString(
    <StaticRouterProvider router={router} context={context} />,
  )

  return {
    status: context.statusCode,
    html,
  }
}
