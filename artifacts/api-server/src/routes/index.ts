import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scanRouter from "./scan";
import dealsRouter from "./deals";
import statsRouter from "./stats";
import keywordsRouter from "./keywords";
import alertsRouter from "./alerts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scanRouter);
router.use(dealsRouter);
router.use(statsRouter);
router.use(keywordsRouter);
router.use(alertsRouter);

export default router;
