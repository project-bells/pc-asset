; Inno Setup Script for Enterprise Asset Management & Monitoring Agent
; Creates an enterprise-grade silent installer for Intune, SCCM, and GPO deployment.

#define MyAppName "Enterprise Asset Monitoring Agent"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Enterprise IT Systems"
#define MyAppExeName "AssetMonitoringAgent.exe"
#define MyServiceInternalName "EnterpriseAssetAgent"

[Setup]
AppId={{9F83A4C2-8E10-B74D-9214-E5A73824901B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\EnterpriseAssetAgent
DefaultGroupName={#MyAppName}
OutputBaseFilename=EnterpriseAssetAgent-Setup-v{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
CloseApplications=yes
RestartApplications=no
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\{#MyAppExeName}

[Files]
Source: "..\bin\Release\net8.0-windows\win-x64\publish\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\bin\Release\net8.0-windows\win-x64\publish\appsettings.json"; DestDir: "{app}"; Flags: ignoreversion onlyifdoesntexist

[Run]
; 1. Register Windows Background Service
Filename: "{sys}\sc.exe"; Parameters: "create ""{#MyServiceInternalName}"" binpath= ""\""{app}\{#MyAppExeName}\"""" start= auto DisplayName= ""{#MyAppName}"""; Flags: runhidden
; 2. Configure Failure Recovery Matrix (Restart on 1st, 2nd, and subsequent crashes)
Filename: "{sys}\sc.exe"; Parameters: "failure ""{#MyServiceInternalName}"" reset= 86400 actions= restart/60000/restart/60000/restart/60000"; Flags: runhidden
; 3. Start Service immediately
Filename: "{sys}\sc.exe"; Parameters: "start ""{#MyServiceInternalName}"""; Flags: runhidden

[UninstallRun]
; Stop and Delete Windows Service upon uninstallation
Filename: "{sys}\sc.exe"; Parameters: "stop ""{#MyServiceInternalName}"""; Flags: runhidden
Filename: "{sys}\sc.exe"; Parameters: "delete ""{#MyServiceInternalName}"""; Flags: runhidden

[Code]
// Custom Inno Setup Pascal Script to parse optional Command-line parameters:
// Example: Setup.exe /VERYSILENT /SERVERURL="https://api.domain.com" /APIKEY="live_key_xyz"
function GetParam(ParamName: string): string;
var
  i: Integer;
  Param: string;
begin
  Result := '';
  for i := 1 to ParamCount do
  begin
    Param := ParamStr(i);
    if Pos('/' + UpperCase(ParamName) + '=', UpperCase(Param)) = 1 then
    begin
      Result := Copy(Param, Length(ParamName) + 3, Length(Param));
      Break;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigFile, ServerUrl, ApiKey, ConfigContent: string;
begin
  if CurStep = ssPostInstall then
  begin
    ServerUrl := GetParam('SERVERURL');
    ApiKey := GetParam('APIKEY');

    if (ServerUrl <> '') or (ApiKey <> '') then
    begin
      ConfigFile := ExpandConstant('{app}\appsettings.json');
      if LoadStringFromFile(ConfigFile, ConfigContent) then
      begin
        if ServerUrl <> '' then
          StringChange(ConfigContent, 'https://api.asset-management.internal', ServerUrl);
        if ApiKey <> '' then
          StringChange(ConfigContent, 'agt_live_9f83a4c28e10b74d92', ApiKey);
        SaveStringToFile(ConfigFile, ConfigContent, False);
      end;
    end;
  end;
end;

