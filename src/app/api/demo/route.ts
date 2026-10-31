import { fail, json } from "@/lib/auth";
import { db, resetDb, save } from "@/lib/db";
import { simulateOne, startResolutionDemo } from "@/lib/sim";

type Action = "demo-on" | "demo-off" | "sim-on" | "sim-off" | "sim-once" | "reset" | "resolve";

export async function POST(req: Request) {
  const { action } = (await req.json()) as { action?: Action };
  const s = db().settings;
  switch (action) {
    case "demo-on":
      s.demoMode = true;
      break;
    case "demo-off":
      s.demoMode = false;
      s.simulation = false;
      break;
    case "sim-on":
      s.demoMode = true;
      s.simulation = true;
      break;
    case "sim-off":
      s.simulation = false;
      break;
    case "sim-once": {
      s.demoMode = true;
      const { report, joined } = simulateOne();
      return json({ report, joined });
    }
    case "reset":
      resetDb();
      return json({ ok: true });
    case "resolve": {
      s.demoMode = true;
      save();
      const started = startResolutionDemo();
      return started ? json(started) : fail("No cluster available for the resolution demo.", 404);
    }
    default:
      return fail("Unknown action.");
  }
  save();
  return json({ demoMode: s.demoMode, simulation: s.simulation });
}
