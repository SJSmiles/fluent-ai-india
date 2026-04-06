import { createSigner } from 'fast-jwt';
import readline from 'node:readline';
import util from 'node:util';

const { JWT_TOKEN_SECRET } = process.env;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = util.promisify(rl.question).bind(rl);

async function questionExample() {
  try {
    const email = await question('Enter your email id to generate JWT? ');
    console.log(`Entered Email: ${email}`);
    console.log('Generating JWT...');
    const signSync = createSigner({ key: JWT_TOKEN_SECRET, expiresIn: 3600000 }); // 1 hour expiry
    const token = signSync({ email });
    console.log('Your JWT is: ');
    console.log('Bearer', token);

    console.log();
    console.log('JWT copied to clipboard');
    process.exit(0);
  } catch (err) {
    console.error('Question rejected', err);
  }
}
questionExample();
