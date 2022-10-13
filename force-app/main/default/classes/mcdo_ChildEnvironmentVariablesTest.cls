@IsTest
private class mcdo_ChildEnvironmentVariablesTest {
    @TestSetup
    private static void setupData() {
        User standardUser = mcdo_TestDataFactory.createStandardUser();
        insert standardUser;
        List<PermissionSetAssignment> permissions = mcdo_TestDataFactory.createRequiredPermissions(
            standardUser.Id
        );
        insert permissions;

        System.runAs(standardUser) {
            createDefaultTestData();
        }
    }

    @IsTest
    private static void execute() {
        User standardUser = getStandardUser();
        System.runAs(standardUser) {
            copado__Environment__c parentEnvironment = [
                SELECT Id
                FROM copado__Environment__c
                WHERE Name = 'Parent EMEA'
                LIMIT 1
            ];
            List<copado__Environmental_Variable__c> environmentVariables = [
                SELECT Id
                FROM copado__Environmental_Variable__c
            ];

            String result = '';

            Test.startTest();
            result = mcdo_ChildEnvironmentVariableController.getmcdo_ChildEnvironmentVariables(
                parentEnvironment.Id
            );
            Test.stopTest();

            System.assertNotEquals(null, result, 'Environment Variables JSON is null');

            List<mcdo_ChildEnvironmentVariables.Environment> environments = (List<mcdo_ChildEnvironmentVariables.Environment>) JSON.deserialize(
                result,
                List<mcdo_ChildEnvironmentVariables.Environment>.class
            );
            System.assertEquals(3, environments.size(), 'Environment list size is not equal');
            System.assertEquals(
                3,
                environments[0].environmentVariables.size(),
                'Environment Variable list size is not equal'
            );

            Integer totalActualmcdo_ChildEnvironmentVariables =
                environments[0].environmentVariables.size() * environments.size();
            Integer totalExpectedmcdo_ChildEnvironmentVariables = environments.size() * 3;
            Integer totalEnvironmentVariables = totalExpectedmcdo_ChildEnvironmentVariables + 2;

            System.assertEquals(
                totalExpectedmcdo_ChildEnvironmentVariables,
                totalActualmcdo_ChildEnvironmentVariables,
                'Environment Variables list size is not equal for Child Environment'
            );
            System.assertEquals(
                totalEnvironmentVariables,
                environmentVariables.size(),
                'Environment Variables list size is not equal'
            );
        }
    }

    private static User getStandardUser() {
        User standardUser = [
            SELECT Id
            FROM User
            WHERE ProfileId IN (SELECT Id FROM Profile WHERE Name = 'Standard User')
            ORDER BY CreatedDate DESC
            LIMIT 1
        ];
        return standardUser;
    }

    private static void createDefaultTestData() {
        List<copado__Environment__c> mcdo_ChildEnvironments = new List<copado__Environment__c>();
        List<copado__Environmental_Variable__c> environmentVariables = new List<copado__Environmental_Variable__c>();

        copado__Environment__c parentEnvironment = mcdo_TestDataFactory.createTestEnvironment(
            'Parent EMEA',
            'Production/Developer'
        );
        insert parentEnvironment;

        copado__Environment__c mcdo_ChildEnvironmentFrance = mcdo_TestDataFactory.createTestEnvironment(
            'France',
            'Production/Developer'
        );
        mcdo_ChildEnvironmentFrance.mcdo_Parent_Environment__c = parentEnvironment.Id;
        mcdo_ChildEnvironments.add(mcdo_ChildEnvironmentFrance);

        copado__Environment__c mcdo_ChildEnvironmentGermany = mcdo_TestDataFactory.createTestEnvironment(
            'Germany',
            'Production/Developer'
        );
        mcdo_ChildEnvironmentGermany.mcdo_Parent_Environment__c = parentEnvironment.Id;
        mcdo_ChildEnvironments.add(mcdo_ChildEnvironmentGermany);

        copado__Environment__c mcdo_ChildEnvironmentIreland = mcdo_TestDataFactory.createTestEnvironment(
            'Ireland',
            'Production/Developer'
        );
        mcdo_ChildEnvironmentIreland.mcdo_Parent_Environment__c = parentEnvironment.Id;
        mcdo_ChildEnvironments.add(mcdo_ChildEnvironmentIreland);

        insert mcdo_ChildEnvironments;

        for (copado__Environment__c eachEvironment : mcdo_ChildEnvironments) {
            //Environment Variable creation
            for (Integer i = 1; i <= 3; i++) {
                environmentVariables.add(
                    mcdo_TestDataFactory.createTestEnvironmentVariable(
                        eachEvironment.Id,
                        'envVariable_' + i,
                        'envVariableValue_' + i
                    )
                );
            }
        }

        for (Integer i = 1; i <= 2; i++) {
            environmentVariables.add(
                mcdo_TestDataFactory.createTestEnvironmentVariable(
                    parentEnvironment.Id,
                    'envVariable_' + i,
                    'envVariableValue_' + i
                )
            );
        }

        insert environmentVariables;
    }
}
