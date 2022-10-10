public with sharing class ChildEnvironmentVariableController {
    // PUBLIC

    @AuraEnabled
    public static String getChildEnvironmentVariables(String environmentId) {
        String result = '';
        if (String.isNotBlank(environmentId)) {
            ChildEnvironmentVariables controller = new ChildEnvironmentVariables();
            result = controller.execute(environmentId);
        }
        return result;
    }
}
