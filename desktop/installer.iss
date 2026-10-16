; Inno Setup 6 script - built by desktop\build_installer.ps1 (do not run directly unless StageDir is defined)
#define AppName "Mental Health Digital Twin"
#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef StageDir
  #define StageDir "..\build\desktop\stage"
#endif
#ifndef OutputDir
  #define OutputDir "..\build\desktop\output"
#endif

[Setup]
AppId={{8F2C6A51-3B7D-4E2A-9C4B-5D1E7A9F0B21}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Rohith M S
AppPublisherURL=https://github.com/rohithsuresh21/Mental-Health-Digital-Twin-AI-Assistant
DefaultDirName={localappdata}\Programs\MentalHealthDigitalTwin
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir={#OutputDir}
OutputBaseFilename=MentalHealthDigitalTwin-Setup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName={#AppName}
UninstallDisplayIcon={app}\python\pythonw.exe
LicenseFile={#StageDir}\app\LICENSE
SetupLogging=yes

[Messages]
FinishedLabel=Setup has installed [name] and its AI runtime.%n%nThe app runs entirely on this computer (your GPU if available). No data leaves your machine.

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"
Name: "cpuonly"; Description: "Force CPU mode (skip GPU / CUDA download)"; GroupDescription: "AI runtime:"; Flags: unchecked

[Dirs]
Name: "{app}\app\data"
Name: "{app}\logs"

[Files]
Source: "{#StageDir}\python\*"; DestDir: "{app}\python"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "{#StageDir}\app\*"; DestDir: "{app}\app"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\python\pythonw.exe"; Parameters: """{app}\app\desktop\launcher.py"""; WorkingDir: "{app}\app"; IconFilename: "{app}\app\desktop\app.ico"; Check: HasIcon
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\python\pythonw.exe"; Parameters: """{app}\app\desktop\launcher.py"""; WorkingDir: "{app}\app"; Check: not HasIcon
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\python\pythonw.exe"; Parameters: """{app}\app\desktop\launcher.py"""; WorkingDir: "{app}\app"; IconFilename: "{app}\app\desktop\app.ico"; Tasks: desktopicon; Check: HasIcon
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\python\pythonw.exe"; Parameters: """{app}\app\desktop\launcher.py"""; WorkingDir: "{app}\app"; Tasks: desktopicon; Check: not HasIcon
Name: "{autoprograms}\{#AppName} - Repair runtime"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\app\desktop\setup_runtime.ps1"" -Force"; WorkingDir: "{app}\app"
Name: "{autoprograms}\{#AppName} - Stop"; Filename: "{app}\python\pythonw.exe"; Parameters: """{app}\app\desktop\launcher.py"" --stop"; WorkingDir: "{app}\app"
Name: "{autoprograms}\{#AppName} - Logs"; Filename: "{app}\logs"

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\app\desktop\setup_runtime.ps1"" -Force"; StatusMsg: "Downloading the AI runtime (PyTorch + models for your GPU, several GB). A console window shows progress..."; Flags: waituntilterminated; Tasks: not cpuonly
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\app\desktop\setup_runtime.ps1"" -Force -Device cpu"; StatusMsg: "Downloading the AI runtime (CPU build + models). A console window shows progress..."; Flags: waituntilterminated; Tasks: cpuonly
Filename: "{app}\python\pythonw.exe"; Parameters: """{app}\app\desktop\launcher.py"""; WorkingDir: "{app}\app"; Description: "Launch {#AppName}"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{app}\python\pythonw.exe"; Parameters: """{app}\app\desktop\launcher.py"" --stop"; Flags: runhidden skipifdoesntexist; RunOnceId: "StopApp"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\python"
Type: filesandordirs; Name: "{app}\models_cache"
Type: filesandordirs; Name: "{app}\edge-profile"
Type: filesandordirs; Name: "{app}\logs"
Type: filesandordirs; Name: "{app}\wheelhouse"
Type: files; Name: "{app}\runtime_ready.json"

[Code]
function HasIcon: Boolean;
begin
  Result := FileExists(ExpandConstant('{app}\app\desktop\app.ico'));
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    if DirExists(ExpandConstant('{app}\app\data')) then
    begin
      if MsgBox('Also delete your local patient data (entries, reports, database)?' + #13#10 +
                'Choose No to keep it for a future reinstall.', mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
        DelTree(ExpandConstant('{app}'), True, True, True)
      else
      begin
        // keep {app}\app\data, remove everything else in {app}\app
        DelTree(ExpandConstant('{app}\app\Stage_1'), True, True, True);
        DelTree(ExpandConstant('{app}\app\stage_2'), True, True, True);
        DelTree(ExpandConstant('{app}\app\stage_3'), True, True, True);
        DelTree(ExpandConstant('{app}\app\stage_4'), True, True, True);
        DelTree(ExpandConstant('{app}\app\Stage_5'), True, True, True);
        DelTree(ExpandConstant('{app}\app\XAI'), True, True, True);
        DelTree(ExpandConstant('{app}\app\daily_portal'), True, True, True);
        DelTree(ExpandConstant('{app}\app\data_parser'), True, True, True);
        DelTree(ExpandConstant('{app}\app\desktop'), True, True, True);
        DelTree(ExpandConstant('{app}\app\frontend'), True, True, True);
        DelTree(ExpandConstant('{app}\app\pipeline_outputs'), True, True, True);
        DelTree(ExpandConstant('{app}\app\lightning_logs'), True, True, True);
        DelTree(ExpandConstant('{app}\app\__pycache__'), True, True, True);
      end;
    end;
  end;
end;
