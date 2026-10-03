using System.IO;
using UnityEngine;

namespace NuoBrew.ContentLink
{
    /// <summary>
    /// 仓库根目录的 content/。运行时只读这一份表，不在 Assets 里再复制一份。
    /// </summary>
    public static class ContentRoot
    {
        public static string Path =>
            System.IO.Path.GetFullPath(System.IO.Path.Combine(Application.dataPath, "..", "..", "..", "content"));
    }
}
