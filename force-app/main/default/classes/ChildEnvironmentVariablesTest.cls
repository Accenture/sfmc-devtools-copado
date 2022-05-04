@IsTest
private class ChildEnvironmentVariablesTest {
    
    @TestSetup
    private static void setupData() {
        User standardUser = createStandardUser();
        insert standardUser;

        List<PermissionSetAssignment> requiredPermissions = createRequiredPermissions(standardUser.Id);
        insert requiredPermissions;

        System.runAs(standardUser) {
            data();
        }
    }

    @IsTest
    static void execute() {
            User standardUser = [SELECT Id FROM User WHERE Username = 'test.username@testdomain.com'];

            System.runAs(standardUser) {
    
                copado__Environment__c parentEnvironment = [SELECT Id FROM copado__Environment__c WHERE Name = 'Parent Bu' LIMIT 1];
                List<copado__Environmental_Variable__c> environmentVariables = [SELECT Id FROM copado__Environmental_Variable__c];
                
                String result = '';
    
                Test.startTest();
                ChildEnvironmentVariables cls = new ChildEnvironmentVariables();
                result = cls.execute(parentEnvironment.Id);
                Test.stopTest();
    
                System.assertNotEquals(null, result, 'Environment Variables JSON is null');
    
                List<ChildEnvironmentVariables.ChildEnvironmentVariablesRecord> records = (List<ChildEnvironmentVariables.ChildEnvironmentVariablesRecord>) JSON.deserialize(
                    result,
                    List<ChildEnvironmentVariables.ChildEnvironmentVariablesRecord>.class
                );
                System.assertEquals(2, records.size(), 'Environment list size is not equal');
                ChildEnvironmentVariables.ChildEnvironmentVariablesRecord childEnvData = records[0].environmentName == 'Child Bu1' ? records[0] : records[1];
                System.assertEquals(environmentVariables.size(), childEnvData.environmentVariables.size(), 'Environment Variables list size is not equal');
            }
    }
    
    private static User createStandardUser() {
        return createUser('LastName', 'test2@test2.com', 'test.username@testdomain.com', 'alias2');
    }
    
    private static List<PermissionSetAssignment> createRequiredPermissions(Id userId) {
        List<PermissionSetAssignment> assignments = new List<PermissionSetAssignment>();
        assignments.addAll(createPermissions(userId, new Set<String> {'Copado_Marketing_Cloud_Extension_Access', 'Copado_User', 'Copado_Functions'}));
        return assignments;
    }

    private static User createUser(String lastName, String email, String username, String alias) {
        User standardUser = new User();
        standardUser.ProfileId = [SELECT Id FROM Profile WHERE Name = 'Standard User'].Id;
        standardUser.LastName = lastName;
        standardUser.Email = email;
        standardUser.Username = username;
        standardUser.Alias = alias;
        standardUser.TimeZoneSidKey = 'America/Los_Angeles';
        standardUser.EmailEncodingKey = 'UTF-8';
        standardUser.LanguageLocaleKey = 'en_US';
        standardUser.LocaleSidKey = 'en_US';
        return standardUser;
    }

    private static List<PermissionSetAssignment> createPermissions(Id userId, Set<String> permissionSetNames) {
        List<PermissionSet> permissionSets = [SELECT Id FROM PermissionSet WHERE Name IN :permissionSetNames];
        List<PermissionSetAssignment> assignments = new List<PermissionSetAssignment>();
        for (PermissionSet thisPermission : permissionSets) {
            PermissionSetAssignment assignment = new PermissionSetAssignment();
            assignment.PermissionSetId = thisPermission.Id;
            assignment.AssigneeId = userId;
            assignments.add(assignment);
        }
        return assignments;
    }

    
    private static void data() {
        List<copado__Environment__c> parentEnvironments = new List<copado__Environment__c>();
        List<copado__Environment__c> environments = new List<copado__Environment__c>();
        List<copado__Environmental_Variable__c> environmentVariables = new List<copado__Environmental_Variable__c>();

        //Environment creation
        copado__Environment__c parentEnvironment = new copado__Environment__c();
        parentEnvironment.copado__Type__c = 'Production/Developer';
        parentEnvironment.Name = 'Parent Bu';
        parentEnvironment.copado__Platform__c = 'Marketing Cloud';
        parentEnvironments.add(parentEnvironment);
        insert parentEnvironments;
        
        copado__Environment__c childEnvironment1 = new copado__Environment__c();
        childEnvironment1.copado__Type__c = 'Production/Developer';
        childEnvironment1.Name = 'Child Bu1';
        childEnvironment1.copado__Platform__c = 'Marketing Cloud';
        childEnvironment1.Parent_Environment__c = parentEnvironments[0].Id;
        environments.add(childEnvironment1);
        
        copado__Environment__c childEnvironment2 = new copado__Environment__c();
        childEnvironment2.copado__Type__c = 'Production/Developer';
        childEnvironment2.Name = 'Child Bu2';
        childEnvironment2.copado__Platform__c = 'Marketing Cloud';
        childEnvironment2.Parent_Environment__c = parentEnvironments[0].Id;
        environments.add(childEnvironment2);
        insert environments;

        //Environment Variable creation
        for (Integer i = 0; i < 5; i++) {
            String text = 'environmentVariables' + i;
            copado__Environmental_Variable__c environmentVariable = new copado__Environmental_Variable__c();
            environmentVariable.Name = text;
            environmentVariable.copado__Value__c = '' + i;
            environmentVariable.copado__Environment__c = environments[0].Id;
            environmentVariables.add(environmentVariable);
        }
        insert environmentVariables;
    }
}