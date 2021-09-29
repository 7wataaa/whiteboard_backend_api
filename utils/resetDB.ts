import util from 'util';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const exec = util.promisify(require('child_process').exec);

export const resetDB = async (): Promise<void> => {
  await exec(
    'DATABASE_URL="postgresql://postgres:postgres@db:5432/test" npx prisma migrate reset --force'
  );
};
