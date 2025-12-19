# 英雄联盟战绩展示系统需求文档 (v2.0 - 正规化架构版)

## 1. 项目概述

本项目旨在开发一个全栈应用，用于展示玩家的英雄联盟对局战绩。
**v2.0 核心变更：** 从单人单局记录升级为**全量对局记录**。系统将存储每一局比赛的完整信息（包括红蓝双方共 10 名玩家的详细数据），以支持更深度的复盘、数据分析和“上帝视角”查看。

### 系统架构概览

1.  **本地数据采集脚本 (Python/Node/C#):** 运行在玩家本地，通过 LCU API 获取 **完整的对局结算数据 (End of Game)**。
2.  **后端 API (.NET Core):** 接收并解析复杂对局数据，采用**主从表 (1:N)** 结构存储。
3.  **前端页面 (React/Vue/Angular等):**
    *   **列表页:** 展示概要战绩。
    *   **详情页:** 展示 10 人详细数据对比（伤害、经济、出装等）。

## 2. 后端 API (基于 .NET Core)

### 2.1 代码位置

所有与英雄联盟战绩相关控制器代码将位于：`E:\Code\myWebAPI\Controllers\lol\`

### 2.2 核心数据模型 (Schema Design)

需要在 `E:\Code\myWebAPI\Models\` 目录下创建/重构以下两个模型。

#### 2.2.1 主表：对局元数据 (`Match.cs`)

存储一场比赛的公共信息，不包含具体玩家表现。

| 字段名 | 类型 | 描述 | 备注 |
| :--- | :--- | :--- | :--- |
| `MatchId` | `long` | **[Key, DatabaseGenerated(None)]** Riot 对局 ID | 唯一标识，不自增 |
| `GameMode` | `string` | 游戏模式 | e.g., "ARAM", "CLASSIC" |
| `GameType` | `string` | 游戏类型 | e.g., "MATCHED_GAME" |
| `QueueId` | `int` | 队列 ID | 420(排位), 450(大乱斗) |
| `GameDuration` | `long` | 游戏持续秒数 | |
| `GameCreation` | `DateTime` | 游戏开始时间 | |
| `GameVersion` | `string` | 游戏版本 | e.g., "13.24.1" |
| `Participants` | `List<MatchParticipant>` | **导航属性** | 1对多关系 |

#### 2.2.2 从表：玩家详情 (`MatchParticipant.cs`)

存储单场比赛中单个玩家的详细数据。每场比赛会有 10 条记录关联到同一个 `MatchId`。

| 字段名 | 类型 | 描述 | 备注 |
| :--- | :--- | :--- | :--- |
| `Id` | `int` | **[Key]** 自增主键 | |
| `MatchId` | `long` | **外键** | 关联 `Match.MatchId` |
| `SummonerName` | `string` | 召唤师名称 | |
| `Puuid` | `string` | Riot 全局唯一 ID | (可选) 比名字更稳定 |
| `TeamId` | `int` | 队伍 ID | 100(蓝方), 200(红方) |
| `ChampionId` | `int` | 英雄 ID | |
| `ChampionName` | `string` | 英雄英文名 | |
| **基础战绩** | | | |
| `Win` | `bool` | 是否胜利 | |
| `Kills` | `int` | 击杀 | |
| `Deaths` | `int` | 死亡 | |
| `Assists` | `int` | 助攻 | |
| **战斗数据** | | | |
| `TotalDamageDealtToChampions` | `int` | 对英雄总伤害 | |
| `TotalDamageTaken` | `int` | 承受伤害 | |
| **经济与发育** | | | |
| `GoldEarned` | `int` | 总金币 | |
| `TotalMinionsKilled` | `int` | 补刀数 | |
| **装备** | | | |
| `Item0` ~ `Item6` | `int` | 7个装备栏 ID | 建议直接定义7个字段，或存逗号分隔字符串 |
| `VisionScore` | `int` | 视野得分 | (可选) |

### 2.3 API 接口设计

将在 `Controllers/lol/` 目录下更新 `LolController.cs`。

#### 2.3.1 对局数据上传接口 (Refactored)

*   **HTTP 方法:** `POST`
*   **路径:** `/api/lol/upload`
*   **描述:** 接收包含完整 10 人数据的复杂对象。
*   **请求体 (示例结构):**
    ```json
    {
        "matchInfo": {
            "matchId": 1234567890,
            "gameMode": "ARAM",
            "gameCreation": "2025-12-19T20:00:00Z",
            "gameDuration": 1500,
            "gameVersion": "13.24.1"
        },
        "participants": [
            { "summonerName": "Me", "teamId": 100, "championId": 81, "kills": 10 ... },
            { "summonerName": "Teammate1", "teamId": 100, "championId": 1, "kills": 2 ... },
            // ... 共10人
        ]
    }
    ```
*   **逻辑:** 
    1.  检查 `MatchId` 是否存在。
    2.  如果不存在，开启事务。
    3.  插入 `Match` 记录。
    4.  遍历并插入 10 条 `MatchParticipant` 记录。
    5.  提交事务。

#### 2.3.2 历史战绩列表查询 (Refactored)

*   **HTTP 方法:** `GET`
*   **路径:** `/api/lol/history`
*   **查询参数:** `summonerName`, `page`, `pageSize`.
*   **逻辑:** 
    *   联表查询 (`Join`): `Match` JOIN `MatchParticipant`.
    *   **过滤条件:** `MatchParticipant.SummonerName == summonerName`.
    *   **返回数据:** 返回 `Match` 信息 + **该玩家自己** 的 `MatchParticipant` 信息 (作为列表概览)。

#### 2.3.3 单局详情查询 (New)

*   **HTTP 方法:** `GET`
*   **路径:** `/api/lol/match/{matchId}`
*   **描述:** 获取指定对局的完整 10 人数据。
*   **逻辑:** 
    1.  查询 `Match` 表获取基础信息。
    2.  查询 `MatchParticipant` 表获取 `Where MatchId == matchId` 的所有记录。
    3.  将 10 人数据按 `TeamId` 分组返回。

## 3. 数据库集成

### 3.1 DbContext 更新

```csharp
public class ApplicationDbContext : DbContext
{
    // ...
    public DbSet<Match> Matches { get; set; }
    public DbSet<MatchParticipant> MatchParticipants { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // 配置一对多关系
        modelBuilder.Entity<Match>()
            .HasMany(m => m.Participants)
            .WithOne()
            .HasForeignKey(p => p.MatchId);
    }
}
```

## 4. 前端展示逻辑 (Data Dragon)

保持 v1.0 逻辑不变。
*   英雄头像: `.../img/champion/{ChampionName}.png`
*   装备图标: `.../img/item/{ItemId}.png`

后端只需返回 ID 和 Name，前端负责拼接 URL。

## 5. 开发步骤建议

1.  **清理旧代码:** 备份并移除旧的 `LolMatch.cs` 和相关迁移。
2.  **创建新模型:** 定义 `Match` 和 `MatchParticipant` 类。
3.  **数据库迁移:** 执行 `add-migration RefactorLolSchema` 和 `database update`。
4.  **重写 Controller:** 实现上述新的 API 逻辑。