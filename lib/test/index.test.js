'use strict';

const { expect } = require('chai');
const runServerless = require('../../test/run-serverless');

const modulesCacheStub = {
  '@serverless/dashboard-plugin/lib/test/run-test': async () => {},
  [require.resolve('@serverless/utils/config')]: {
    ...require('@serverless/utils/config'),
    getLoggedInUser: () => ({
      accessKeys: { testinteractivecli: 'accesskey' },
    }),
  },
  [require.resolve('@serverless/platform-client')]: {
    ServerlessSDK: class ServerlessSDK {
      constructor() {
        this.metadata = {
          get: async () => ({
            awsAccountId: '111111111111',
            supportedRuntimes: ['nodejs8.10', 'nodejs10.x', 'python2.7', 'python3.6', 'python3.7'],
            supportedRegions: [
              'us-east-1',
              'us-east-2',
              'us-west-2',
              'eu-central-1',
              'eu-west-1',
              'eu-west-2',
              'ap-northeast-1',
              'ap-southeast-1',
              'ap-southeast-2',
            ],
          }),
        };
      }

      async getOrgByName() {
        return { orgUid: 'foobar' };
      }
      async getProvidersByOrgServiceInstance() {
        return {};
      }
    },
  },
};

const awsRequestStubMap = {
  CloudFormation: {
    describeStacks: {
      Stacks: [{ Outputs: [{ OutputKey: 'ServiceEndpointFoo', OutputValue: 'https://' }] }],
    },
  },
};

describe('test', () => {
  describe('Pass', () => {
    let output;
    before(async () => {
      ({ output } = await runServerless({
        fixture: 'test-command',
        command: 'test',
        modulesCacheStub,
        awsRequestStubMap,
        configExt: {
          disabledDeprecations: ['EXT_TEST_COMMAND'],
        },
      }));
    });

    it('should print summary', () => {
      expect(output).to.include('Test Results:');
      expect(output).to.include('3 passed');
      expect(output).to.include('0 failed');
    });
    it('should support specific endpoints', () =>
      expect(output).to.include('passed - GET foo - endpoint'));
    it('should auto resolve endpoint', () =>
      expect(output).to.include('passed - GET /foo - function'));
    it('should auto resolve endpoint written with shorthand notation', () =>
      expect(output).to.include('passed - GET /bar - shorthand'));
  });

  describe('Failure', () => {
    let output;
    before(async () => {
      try {
        await runServerless({
          fixture: 'test-command',
          command: 'test',
          configExt: {
            disabledDeprecations: ['EXT_TEST_COMMAND'],
          },
          modulesCacheStub: {
            ...modulesCacheStub,
            '@serverless/dashboard-plugin/lib/test/run-test': async (testSpec) => {
              if (testSpec.name === 'function') {
                throw Object.assign(new Error('Fail'), {
                  resp: { headers: {} },
                });
              }
            },
          },
          awsRequestStubMap,
        });
      } catch (error) {
        if (error.code !== 'TEST_FAILURE') throw error;
        output = error.output;
        return;
      }
      throw new Error('Unexpected success');
    });

    it('should print summary', () => {
      expect(output).to.include('Test Results:');
      expect(output).to.include('2 passed');
      expect(output).to.include('1 failed');
    });
    it('should support specific endpoints', () =>
      expect(output).to.include('passed - GET foo - endpoint'));
    it('should auto resolve endpoint', () =>
      expect(output).to.include('failed - GET /foo - function'));
    it('should auto resolve endpoint written with shorthand notation', () =>
      expect(output).to.include('passed - GET /bar - shorthand'));
  });
});
