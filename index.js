
import initiateApp from './utils/App/initiateApp.js';
import MainRoutes from './modules/indexRouters.js';
import path from 'path';
import { config } from 'dotenv'; 
config({ path: path.resolve('./config/.env') });



const { app, startServer } = initiateApp(MainRoutes); //main routes is the routes object that contains all the routes for the application

startServer();


export default app; 