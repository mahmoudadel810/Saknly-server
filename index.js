import './utils/loadEnv.js'; // must stay the first import: loads env before other modules read it
import initiateApp from './utils/App/initiateApp.js';
import MainRoutes from './modules/indexRouters.js';

const { app, startServer } = initiateApp(MainRoutes); //main routes is the routes object that contains all the routes for the application

// On Vercel the exported app is the handler; only listen when running locally
if (!process.env.VERCEL)
{
    startServer();
}

export default app;
