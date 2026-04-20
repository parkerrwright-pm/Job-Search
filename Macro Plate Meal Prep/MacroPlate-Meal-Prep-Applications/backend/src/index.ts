import cors from "cors";
import express, { Request, Response } from "express";

const app = express();
const PORT = Number(process.env.PORT || 5051);

app.use(cors());
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "macroplate-applications-backend" });
});

app.get("/api/applications", (_req: Request, res: Response) => {
  res.json({
    applications: [
      {
        id: "app-001",
        name: "Weekly Delivery Planning",
        status: "active",
      },
    ],
  });
});

app.listen(PORT, () => {
  console.log(`MacroPlate backend listening on port ${PORT}`);
});
