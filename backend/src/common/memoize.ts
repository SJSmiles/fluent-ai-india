import moize from 'moize';

moize.collectStats();
const customSerializer = (args: any) => [JSON.stringify(args)];

export default moize.serializeWith(customSerializer);
