@SuppressWarnings('PMD.AvoidGlobalModifier')
global with sharing class mcdo_SourceEnvironmentVariables implements copado.ParameterExpressionCallable {
    // GLOBAL

    global String execute(Id environmentId) {
        List<EnvironmentVariablesRecord> result = new List<EnvironmentVariablesRecord>();
        for (
            copado__Environmental_Variable__c environmentVariable : getEnvironmentVariables(
                environmentId
            )
        ) {
            result.add(
                new EnvironmentVariablesRecord(
                    environmentVariable.Name,
                    environmentVariable.copado__Value__c,
                    environmentVariable.copado__Scope__c
                )
            );
        }

        return JSON.serialize(result);
    }

    // PRIVATE

    private List<copado__Environmental_Variable__c> getEnvironmentVariables(Id environmentId) {
        return [
            SELECT Id, Name, copado__Value__c, copado__Scope__c
            FROM copado__Environmental_Variable__c
            WHERE copado__Environment__c = :environmentId
            WITH SECURITY_ENFORCED
        ];
    }

    // WRAPPER

    public class EnvironmentVariablesRecord {
        public String name { get; set; }
        public String value { get; set; }
        public String scope { get; set; }

        public EnvironmentVariablesRecord(String n, String v, String s) {
            this.name = n;
            this.value = v;
            this.scope = s;
        }
    }
}
