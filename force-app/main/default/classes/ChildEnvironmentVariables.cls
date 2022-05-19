global with sharing class ChildEnvironmentVariables implements copado.ParameterExpressionCallable {
    // GLOBAL

    private Map<String, List<EnvironmentVariablesRecord>> envVariablesByEnvName = new Map<String, List<EnvironmentVariablesRecord>>();

    global String execute(Id environmentId) {
        List<ChildEnvironmentVariablesRecord> result = new List<ChildEnvironmentVariablesRecord>();
        for (copado__Environmental_Variable__c environmentVariable : getEnvironmentVariables(environmentId)) {
            List<EnvironmentVariablesRecord> environmentVariables = new List<EnvironmentVariablesRecord>();
            if(envVariablesByEnvName.containsKey(environmentVariable.copado__Environment__r.name)) {
               environmentVariables = envVariablesByEnvName.get(environmentVariable.copado__Environment__r.name);
            }
            
           environmentVariables.add(new EnvironmentVariablesRecord(environmentVariable.Name, environmentVariable.copado__Value__c, environmentVariable.copado__Scope__c));
           envVariablesByEnvName.put(environmentVariable.copado__Environment__r.name, environmentVariables);  
        }

        for(copado__Environment__c environment: getChildEnvironments(environmentId)) {
            List<EnvironmentVariablesRecord> environmentVariables = new List<EnvironmentVariablesRecord>();
            if(envVariablesByEnvName.containsKey(environment.Name)) {
                environmentVariables = envVariablesByEnvName.get(environment.Name);
            }
            result.add(new ChildEnvironmentVariablesRecord(environment.Name, environmentVariables));
        }
        return JSON.serialize(result);
    }

    // PRIVATE

    private List<copado__Environmental_Variable__c> getEnvironmentVariables(Id environmentId) {
        return [SELECT Id, Name, copado__Value__c, copado__Scope__c, copado__Environment__r.name FROM copado__Environmental_Variable__c where copado__Environment__r.Parent_Environment__c = :environmentId WITH SECURITY_ENFORCED ORDER BY Name];
    }
    
    private List<copado__Environment__c> getChildEnvironments(Id environmentId) {
        return [SELECT Id, Name FROM copado__Environment__c where Parent_Environment__c = :environmentId WITH SECURITY_ENFORCED];
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
    
    public class ChildEnvironmentVariablesRecord {
        public String environmentName { get; set; }
        public List<EnvironmentVariablesRecord> environmentVariables { get; set; }

        public ChildEnvironmentVariablesRecord(String environmentName, List<EnvironmentVariablesRecord> environmentVariables) {
            this.environmentName = environmentName;
            this.environmentVariables = environmentVariables;
        }
    }
}