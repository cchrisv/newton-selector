const { jestConfig } = require("@salesforce/sfdx-lwc-jest/config");

module.exports = {
  ...jestConfig,
  moduleNameMapper: {
    "^c/newtonSelectorFlowCpeUtilityConfigStyles$":
      "<rootDir>/force-app/test/jest-mocks/newtonSelectorFlowCpeUtilityConfigStyles",
    "^c/newtonSelectorFlowCpeUtilityTokens$":
      "<rootDir>/force-app/test/jest-mocks/newtonSelectorFlowCpeUtilityTokens",
    "^lightning/flowSupport$":
      "<rootDir>/force-app/test/jest-mocks/lightning/flowSupport"
  }
};
