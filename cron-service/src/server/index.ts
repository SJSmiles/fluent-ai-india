
import express from 'express';
import bodyParser from 'body-parser';
import { dynamicCroner, processPendingCalls, setUpNewCron, startNewCron, stopCron, stopCrons } from '../dynamicCroner';


const app = express();
const port = process.env.PORT || '3001';

app.use(bodyParser.json());


async function init() {
    await dynamicCroner()
}

//to add new cron-job
app.post('/start-cron', async (req: any, res: any) => {
    await startNewCron(req.body);
    return res.status(200).json({ message: 'New cron job started successfully' });
});

//to stop any cron at a time 
app.post('/stop-cron', async (req: any, res: any) => {
    const { id } = req.body;
    await stopCron(id);
    return res.status(200).json({ message: 'Cron job stopped successfully' });
});

//to add new cron-job
app.post('/setup-crons', async (req: any, res: any) => {
    await setUpNewCron(req.body);
    return res.status(200).json({ message: 'New cron job started successfully' });
});

//to delete cron-job
app.post('/stop-crons', async (req: any, res: any) => {
    await stopCrons(req.body);
    return res.status(200).json({ message: 'Cron job stopped successfully' });
});

app.post('/process-pending-calls', async (req: any, res: any) => {
    await processPendingCalls(req.body);
    return res.status(200).json({ message: 'New cron job started successfully' });
});


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
init()
