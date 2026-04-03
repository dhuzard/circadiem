import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 5174);
const app = createApp();

app.listen(port, () => {
  console.log(`Vision review server listening on http://localhost:${port}`);
});
