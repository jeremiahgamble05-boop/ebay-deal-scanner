import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scanRouter from "./scan";
import dealsRouter from "./deals";
import statsRouter from "./stats";
import keywordsRouter from "./keywords";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scanRouter);
router.use(dealsRouter);
router.use(statsRouter);
router.use(keywordsRouter);

export default router;
