import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import dashboardRouter from "./routes/dashboard";
import projectsRouter from "./routes/projects";
import { seedDefaults } from "./seed";

const REQUIRED_ENV_VARS = ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET", "ADMIN_EMAIL", "OWNER_EMAIL"];
const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
}

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/projects", projectsRouter);

const webDist = path.join(__dirname, "../../web/dist");
app.use(express.static(webDist));
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(webDist, "index.html"));
});

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

seedDefaults()
  .catch((err) => console.error("Startup bootstrap failed:", err))
  .finally(() => {
    app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  });
