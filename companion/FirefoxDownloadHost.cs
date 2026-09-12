using System;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;
using System.Xml.Linq;
using System.Collections.Generic;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

static class FirefoxDownloadHost {
    static readonly HashSet<string> ReservedNames=new HashSet<string>(StringComparer.OrdinalIgnoreCase) {
        "CON","PRN","AUX","NUL","COM1","COM2","COM3","COM4","COM5","COM6","COM7","COM8","COM9",
        "LPT1","LPT2","LPT3","LPT4","LPT5","LPT6","LPT7","LPT8","LPT9"
    };

    static string SafeFolder(string value) {
        foreach(char c in Path.GetInvalidFileNameChars()) value=value.Replace(c, '_');
        value=value.Trim().TrimEnd('.');
        if(value.Length>100) value=value.Substring(0,100).TrimEnd();
        if(String.IsNullOrWhiteSpace(value)) return "ChatGPT conversation";
        if(ReservedNames.Contains(value)) value="_"+value;
        return value;
    }

    static string UniquePath(string directory,string filename) {
        string candidate=Path.Combine(directory,filename);
        if(!File.Exists(candidate)) return candidate;
        string stem=Path.GetFileNameWithoutExtension(filename), extension=Path.GetExtension(filename);
        for(int n=2;n<10000;n++) {
            candidate=Path.Combine(directory,stem+" ("+n+")"+extension);
            if(!File.Exists(candidate)) return candidate;
        }
        throw new IOException("Unable to select a unique destination filename.");
    }

    static string ConfiguredTemp() {
        string settings=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"folders.xml");
        string temp=(string)XDocument.Load(settings).Root.Element("Temp");
        if(String.IsNullOrWhiteSpace(temp) || !Path.IsPathRooted(temp)) throw new IOException("The configured TEMP folder is invalid.");
        return Path.GetFullPath(temp);
    }

    static string Move(IDictionary<string,object> message) {
        string source=Convert.ToString(message["source"]);
        if(!Path.IsPathRooted(source) || !File.Exists(source)) throw new IOException("Downloaded file does not exist.");
        string mode=message.ContainsKey("mode") ? Convert.ToString(message["mode"]) : "";
        string directory;
        if(String.Equals(mode,"chatgpt",StringComparison.OrdinalIgnoreCase)) {
            string temp=ConfiguredTemp();
            string conversation=SafeFolder(message.ContainsKey("conversation") ? Convert.ToString(message["conversation"]) : "");
            directory=Path.GetFullPath(Path.Combine(temp,conversation));
            string root=temp.TrimEnd(Path.DirectorySeparatorChar)+Path.DirectorySeparatorChar;
            if(!directory.StartsWith(root,StringComparison.OrdinalIgnoreCase)) throw new IOException("Unsafe destination path.");
        } else if(String.Equals(mode,"folder",StringComparison.OrdinalIgnoreCase)) {
            string folder=message.ContainsKey("folder") ? Convert.ToString(message["folder"]) : "";
            if(String.IsNullOrWhiteSpace(folder) || !Path.IsPathRooted(folder)) throw new IOException("The destination folder is invalid.");
            directory=Path.GetFullPath(folder);
        } else throw new IOException("Unknown download route.");
        Directory.CreateDirectory(directory);
        string sourceDirectory=Path.GetFullPath(Path.GetDirectoryName(source)).TrimEnd(Path.DirectorySeparatorChar);
        if(String.Equals(sourceDirectory,directory.TrimEnd(Path.DirectorySeparatorChar),StringComparison.OrdinalIgnoreCase)) return source;
        string destination=UniquePath(directory,Path.GetFileName(source));
        if(String.Equals(Path.GetPathRoot(source),Path.GetPathRoot(destination),StringComparison.OrdinalIgnoreCase)) {
            File.Move(source,destination);
        } else {
            File.Copy(source,destination,false);
            try { File.Delete(source); }
            catch { File.Delete(destination); throw; }
        }
        // An optional privileged Firefox module consumes these data-only requests.
        // Never persist private download metadata.
        if(message.ContainsKey("startTime") && message["startTime"] != null &&
           message.ContainsKey("sourceUrl") && message["sourceUrl"] != null &&
           (!message.ContainsKey("isPrivate") || !Convert.ToBoolean(message["isPrivate"]))) {
            try {
                string queue=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"sync-requests");
                Directory.CreateDirectory(queue);
                string request=Path.Combine(queue,Guid.NewGuid().ToString("N")+".json");
                string json=new JavaScriptSerializer().Serialize(new { source=source, destination=destination,
                    startTime=Convert.ToDouble(message["startTime"]), sourceUrl=Convert.ToString(message["sourceUrl"]) });
                File.WriteAllText(request+".tmp",json,new UTF8Encoding(false));
                File.Move(request+".tmp",request);
            } catch { /* Routing remains successful if optional synchronization is unavailable. */ }
        }
        return destination;
    }

    static string ChooseFolder(IDictionary<string,object> message) {
        using(var dialog=new FolderBrowserDialog()) {
            dialog.Description="Choose a download destination folder";
            dialog.ShowNewFolderButton=true;
            string initial=message.ContainsKey("initialFolder") ? Convert.ToString(message["initialFolder"]) : "";
            if(!String.IsNullOrWhiteSpace(initial) && Directory.Exists(initial)) dialog.SelectedPath=initial;
            return dialog.ShowDialog()==DialogResult.OK ? dialog.SelectedPath : "";
        }
    }

    static string Reveal(IDictionary<string,object> message) {
        string target=message.ContainsKey("path") ? Convert.ToString(message["path"]) : "";
        if(String.IsNullOrWhiteSpace(target) || !Path.IsPathRooted(target)) throw new IOException("The destination path is invalid.");
        target=Path.GetFullPath(target);
        string directory=Directory.Exists(target) ? target : Path.GetDirectoryName(target);
        if(String.IsNullOrWhiteSpace(directory) || !Directory.Exists(directory)) throw new IOException("The destination folder no longer exists.");
        Type shellType=Type.GetTypeFromProgID("Shell.Application");
        if(shellType==null) throw new IOException("The Windows shell is unavailable.");
        object shell=Activator.CreateInstance(shellType);
        try {
            shellType.InvokeMember("Open",BindingFlags.InvokeMethod,null,shell,new object[] { directory });
            if(File.Exists(target)) {
                string filename=Path.GetFileName(target);
                for(int attempt=0;attempt<40;attempt++) {
                    Thread.Sleep(100);
                    object windows=shellType.InvokeMember("Windows",BindingFlags.InvokeMethod,null,shell,null);
                    int count=Convert.ToInt32(windows.GetType().InvokeMember("Count",BindingFlags.GetProperty,null,windows,null));
                    for(int index=0;index<count;index++) {
                        try {
                            object window=windows.GetType().InvokeMember("Item",BindingFlags.InvokeMethod,null,windows,new object[] { index });
                            if(window==null) continue;
                            object document=window.GetType().InvokeMember("Document",BindingFlags.GetProperty,null,window,null);
                            if(document==null) continue;
                            object folder=document.GetType().InvokeMember("Folder",BindingFlags.GetProperty,null,document,null);
                            if(folder==null) continue;
                            object self=folder.GetType().InvokeMember("Self",BindingFlags.GetProperty,null,folder,null);
                            string openPath=Convert.ToString(self.GetType().InvokeMember("Path",BindingFlags.GetProperty,null,self,null));
                            if(!String.Equals(Path.GetFullPath(openPath).TrimEnd(Path.DirectorySeparatorChar),directory.TrimEnd(Path.DirectorySeparatorChar),StringComparison.OrdinalIgnoreCase)) continue;
                            object item=folder.GetType().InvokeMember("ParseName",BindingFlags.InvokeMethod,null,folder,new object[] { filename });
                            if(item==null) continue;
                            document.GetType().InvokeMember("SelectItem",BindingFlags.InvokeMethod,null,document,new object[] { item, 29 });
                            return target;
                        } catch(COMException) {
                            // Explorer can expose a window before its folder view is ready.
                        }
                    }
                }
                throw new IOException("The folder opened, but Windows Explorer could not select the downloaded file.");
            }
        } finally {
            if(shell!=null && Marshal.IsComObject(shell)) Marshal.FinalReleaseComObject(shell);
        }
        return target;
    }

    [STAThread]
    static void Main() {
        var input=Console.OpenStandardInput();
        var output=Console.OpenStandardOutput();
        byte[] sizeBytes=new byte[4];
        if(input.Read(sizeBytes,0,4)!=4) return;
        int size=BitConverter.ToInt32(sizeBytes,0);
        if(size<2 || size>1024*1024) return;
        byte[] data=new byte[size];
        int offset=0, read;
        while(offset<size && (read=input.Read(data,offset,size-offset))>0) offset+=read;
        var json=new JavaScriptSerializer();
        object response;
        try {
            var message=json.Deserialize<Dictionary<string,object>>(Encoding.UTF8.GetString(data,0,offset));
            string action=message.ContainsKey("action") ? Convert.ToString(message["action"]) : "move";
            if(String.Equals(action,"chooseFolder",StringComparison.OrdinalIgnoreCase))
                response=new { ok=true, folder=ChooseFolder(message) };
            else if(String.Equals(action,"reveal",StringComparison.OrdinalIgnoreCase))
                response=new { ok=true, path=Reveal(message) };
            else if(String.Equals(action,"move",StringComparison.OrdinalIgnoreCase))
                response=new { ok=true, destination=Move(message) };
            else throw new IOException("Unknown native host action.");
        } catch(Exception ex) { response=new { ok=false, error=ex.Message }; }
        byte[] reply=Encoding.UTF8.GetBytes(json.Serialize(response));
        byte[] replySize=BitConverter.GetBytes(reply.Length);
        output.Write(replySize,0,replySize.Length); output.Write(reply,0,reply.Length); output.Flush();
    }
}
