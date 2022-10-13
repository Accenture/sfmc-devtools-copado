public with sharing class mcdo_ChildEnvironmentVariableController {
    // PUBLIC

    @AuraEnabled
    public static String getmcdo_ChildEnvironmentVariables(String environmentId) {
        String result = '';
        if (String.isNotBlank(environmentId)) {
            mcdo_ChildEnvironmentVariables controller = new mcdo_ChildEnvironmentVariables();
            result = controller.execute(environmentId);
        }
        return result;
    }
}
