# 英雄联盟战绩展示系统需求文档

## 1. 项目概述

本项目旨在开发一个全栈应用，用于展示玩家的英雄联盟对局战绩。其核心思想是利用本地 LCU API 获取玩家的实时或历史对局数据，通过自定义后端 API 存储和管理这些数据，最终由前端页面进行美观的展示。

### 系统架构概览

1.  **本地数据采集脚本 (Python/Node/C#):** 运行在玩家本地，通过 LCU API 获取对局数据。
2.  **后端 API (.NET Core):** 接收本地脚本上传的数据，并提供查询接口给前端。
3.  **前端页面 (React/Vue/Angular等):** 调用后端 API 获取数据，渲染战绩列表和对局详情。

## 2. 后端 API (基于 .NET Core)

### 2.1 代码位置

所有与英雄联盟战绩相关控制器代码将位于：`E:\Code\myWebAPI\Controllers\lol\`

### 2.2 核心数据模型

需要在 `E:\Code\myWebAPI\Models\` 目录下创建 `LolMatch.cs` 文件，定义对局的核心数据结构。

**`LolMatch.cs` 预期的字段如下：**

| 字段名         | 类型       | 描述                                       | 备注                                     |
| :------------- | :--------- | :----------------------------------------- | :--------------------------------------- |
| `Id`           | `int`      | 主键，数据库自增 ID                        |                                          |
| `MatchId`      | `long`     | 英雄联盟对局的唯一 ID                      | 用于避免重复插入                         |
| `GameMode`     | `string`   | 游戏模式 (如 "ARAM", "CLASSIC")            |                                          |
| `SummonerName` | `string`   | 玩家的召唤师名称                           | 用于区分不同玩家的战绩                   |
| `ChampionId`   | `int`      | 使用英雄的数字 ID                          | 用于前端通过 Data Dragon 获取英雄头像    |
| `ChampionName` | `string`   | 使用英雄的英文名                           | 用于前端通过 Data Dragon 获取英雄头像    |
| `Kills`        | `int`      | 击杀数                                     |                                          |
| `Deaths`       | `int`      | 死亡数                                     |                                          |
| `Assists`      | `int`      | 助攻数                                     |                                          |
| `Win`          | `bool`     | 是否胜利                                   | `true` 为胜利，`false` 为失败            |
| `IsMVP`        | `bool`     | 是否为 MVP                                 |                                          |
| `IsSVP`        | `bool`     | 是否为 SVP                                 |                                          |
| `GameDate`     | `DateTime` | 对局结束时间                               |                                          |
| `GameDuration` | `TimeSpan` | 对局持续时间                               |                                          |
| `TotalDamageDealtToChampions` | `int` | 对英雄造成的总伤害                     | 可选，但通常用于展示                     |
| `TotalMinionsKilled` | `int` | 总补刀数                                 | 可选                                     |
| `ItemIds`      | `string`   | 装备 ID 列表 (例如 "3078,3158,1001...") | 逗号分隔的字符串，用于前端 Data Dragon   |
| `GameVersion`  | `string`   | 游戏版本号 (例如 "13.24.1")                | 用于前端 Data Dragon 拼接正确的资源 URL |

### 2.3 API 接口设计

将在 `Controllers/lol/` 目录下创建 `LolController.cs`，实现以下 API 接口。

#### 2.3.1 对局数据上传接口

*   **HTTP 方法:** `POST`
*   **路径:** `/api/lol/upload`
*   **描述:** 接收本地脚本上传的单局对局数据。
*   **请求体 (Request Body):** JSON 格式，与 `LolMatch` 模型字段对应 (不包含 `Id` 字段)。
    ```json
    {
        "MatchId": 1234567890,
        "GameMode": "ARAM",
        "SummonerName": "YourSummonerName",
        "ChampionId": 81,
        "ChampionName": "Ezreal",
        "Kills": 15,
        "Deaths": 5,
        "Assists": 10,
        "Win": true,
        "IsMVP": true,
        "IsSVP": false,
        "GameDate": "2025-12-18T20:00:00Z",
        "GameDuration": "00:25:30",
        "TotalDamageDealtToChampions": 25000,
        "TotalMinionsKilled": 100,
        "ItemIds": "3078,3158,3004,3035,3046,3142",
        "GameVersion": "13.24.1"
    }
    ```
*   **响应 (Response):**
    *   `200 OK`: 上传成功或对局已存在。
        ```json
        { "message": "Match data processed successfully.", "isNewMatch": true }
        ```
    *   `400 Bad Request`: 请求数据格式错误。
    *   `500 Internal Server Error`: 服务器内部错误。

*   **逻辑:**
    1.  接收 JSON 数据并反序列化为 `LolMatch` 对象。
    2.  根据 `MatchId` 检查数据库中是否已存在该对局。
    3.  如果不存在，则将数据保存到数据库。
    4.  返回相应的成功或失败信息。

#### 2.3.2 对局历史查询接口

*   **HTTP 方法:** `GET`
*   **路径:** `/api/lol/history`
*   **描述:** 提供给前端查询玩家对局历史记录。
*   **查询参数 (Query Parameters):**
    *   `page` (可选, `int`, 默认 1): 页码。
    *   `pageSize` (可选, `int`, 默认 10): 每页数量。
    *   `gameMode` (可选, `string`): 按游戏模式过滤 (例如 "ARAM")。
    *   `summonerName` (必选, `string`): 查询哪个玩家的战绩。
*   **响应 (Response):**
    *   `200 OK`: 返回分页后的对局列表。
        ```json
        {
            "page": 1,
            "pageSize": 10,
            "totalMatches": 100,
            "totalPages": 10,
            "matches": [
                {
                    "Id": 1,
                    "MatchId": 1234567890,
                    "GameMode": "ARAM",
                    "SummonerName": "YourSummonerName",
                    "ChampionId": 81,
                    "ChampionName": "Ezreal",
                    "Kills": 15,
                    "Deaths": 5,
                    "Assists": 10,
                    "Win": true,
                    "IsMVP": true,
                    "IsSVP": false,
                    "GameDate": "2025-12-18T20:00:00Z",
                    "GameDuration": "00:25:30",
                    "TotalDamageDealtToChampions": 25000,
                    "TotalMinionsKilled": 100,
                    "ItemIds": "3078,3158,3004,3035,3046,3142",
                    "GameVersion": "13.24.1"
                },
                // ... 其他对局
            ]
        }
        ```
    *   `400 Bad Request`: 查询参数错误。
    *   `500 Internal Server Error`: 服务器内部错误。

*   **逻辑:**
    1.  根据 `summonerName` 过滤对局。
    2.  根据 `gameMode` (如果提供) 进一步过滤。
    3.  对结果进行分页和排序 (例如按 `GameDate` 倒序)。
    4.  返回分页数据和总数。

## 3. 数据库集成

### 3.1 数据库上下文更新

在 `E:\Code\myWebAPI\Data\ApplicationDbContext.cs` 中，需要添加一个 `DbSet` 来管理 `LolMatch` 实体：

```csharp
public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    // ... 其他 DbSet
    public DbSet<LolMatch> LolMatches { get; set; } // 添加这一行
}
```

### 3.2 数据库迁移

完成 `LolMatch.cs` 和 `ApplicationDbContext.cs` 的修改后，需要使用 Entity Framework Core 的迁移功能来更新数据库模式：

1.  **添加迁移:** 在项目根目录 (myWebAPI.csproj 所在目录) 执行 PowerShell 命令
    ```powershell
    dotnet ef migrations add AddLolMatchTable
    ```
2.  **更新数据库:** 
    ```powershell
    dotnet ef database update
    ```
    这将会在你的数据库中创建 `LolMatches` 表。

## 4. 英雄/装备图标处理 (Data Dragon)

**重要说明：** 绝对不要将图片文件直接存储到数据库中。这样做会导致数据库臃肿、维护困难且效率低下。

### 4.1 核心思想

后端数据库只存储英雄、装备、召唤师技能等的 **ID** 或 **英文名称**。前端通过这些 ID/名称，结合 Riot 官方提供的 **Data Dragon** 静态资源服务，动态拼接出图片 URL 并进行加载。

### 4.2 Data Dragon URL 规则

以下是常用的 Data Dragon 资源 URL 格式。前端需要根据 `GameVersion`、`ChampionName` (或 `ChampionId`) 和 `ItemId` 动态生成。

*   **Data Dragon 版本列表:** `https://ddragon.leagueoflegends.com/api/versions.json` (可以获取最新的版本号)
*   **英雄头像:** 
    `https://ddragon.leagueoflegends.com/cdn/{版本号}/img/champion/{英雄英文名}.png`
    *   **示例:** `https://ddragon.leagueoflegends.com/cdn/13.24.1/img/champion/Ezreal.png`
*   **装备图标:** 
    `https://ddragon.leagueoflegends.com/cdn/{版本号}/img/item/{装备ID}.png`
    *   **示例:** `https://ddragon.leagueoflegends.com/cdn/13.24.1/img/item/3078.png` (贪欲九头蛇)
*   **召唤师技能图标:** 
    `https://ddragon.leagueoflegends.com/cdn/{版本号}/img/spell/{召唤师技能英文名}.png`
    *   **示例:** `https://ddragon.leagueoflegends.com/cdn/13.24.1/img/spell/SummonerFlash.png`

### 4.3 优势

*   **数据库轻量化:** 只存储少量 ID 数据。
*   **自动更新:** Riot 更新 Data Dragon 后，只需更新前端使用的版本号，即可自动获取最新图标。
*   **CDN 加速:** 图片从 Riot 的全球 CDN 加载，速度快且减轻你的服务器负担。

## 5. 本地 LCU API 数据采集脚本 (简要说明)

这部分不属于当前后端项目范围，但作为整个系统的一部分，其逻辑简述如下：

1.  **查找 LCU `lockfile`:** 通常位于游戏安装目录下的 `Riot Games\League of Legends\lockfile`，包含 LCU 的端口号和认证密码。
2.  **连接 LCU API:** 使用 `https` 和从 `lockfile` 获取的 `port` 和 `password` (作为 `Basic Auth` 凭证) 连接 LCU 的 API。
3.  **获取对局数据:** 
    *   **当前对局:** `/liveclientdata/allgamedata` (游戏进行中数据)
    *   **历史对局:** `/lol-match-history/v1/products/lol/current-summoner/matches` (最近N局对局列表)
4.  **数据解析与清洗:** 从 LCU API 返回的 JSON 中提取所需的字段，将其映射到后端 `LolMatch` 模型。
5.  **调用后端 API:** 将清洗后的数据以 `POST` 请求发送到 `/api/lol/upload` 接口。

## 6. 后续开发步骤建议

1.  **定义 `LolMatch` 模型:** 在 `Models` 文件夹中创建 `LolMatch.cs` 并添加上述字段。
2.  **更新 `ApplicationDbContext`:** 在 `Data/ApplicationDbContext.cs` 中添加 `DbSet<LolMatch>`。
3.  **生成并应用数据库迁移:** 使用 `dotnet ef migrations add` 和 `dotnet ef database update` 命令。
4.  **创建 `LolController.cs`:** 在 `Controllers/lol/` 中创建控制器，并实现 `POST /api/lol/upload` 和 `GET /api/lol/history` 接口的初步逻辑。
5.  **单元测试 (推荐):** 为控制器和数据服务编写单元测试以确保功能正确。

希望这份文档能帮助你顺利启动项目！
