import createRepositoryAPI from "../queries.js";
import { jest } from "@jest/globals";

describe("queries repository api", () => {
  test("GetSupportedLanguages cases", async () => {
    const cases = [
      {
        run: async () => {
          const execute = jest.fn().mockResolvedValue([
            { name: "javascript", population: "2" },
            { name: "python", population: "1" }
          ]);
          const repo = createRepositoryAPI(execute);
          const result = await repo.GetSupportedLanguages();
          expect(result).toEqual(["javascript", "python"]);
          const [sql, params] = execute.mock.calls[0];
          expect(sql).toContain("SELECT l.name, r_counts.population");
          expect(sql).toContain("ORDER BY population DESC");
          expect(params).toEqual([]);
        }
      },
      {
        run: async () => {
          const execute = jest.fn().mockResolvedValue([]);
          const repo = createRepositoryAPI(execute);
          const result = await repo.GetSupportedLanguages();
          expect(result).toEqual([]);
          expect(execute).toHaveBeenCalledTimes(1);
        }
      },
      {
        run: async () => {
          const execute = jest.fn().mockRejectedValue(new Error("db fail"));
          const repo = createRepositoryAPI(execute);
          await expect(repo.GetSupportedLanguages()).rejects.toThrow("db fail");
        }
      }
    ];

    for (const testCase of cases) {
      await testCase.run();
    }
  });

  test("GetPopularTags cases", async () => {
    const cases = [
      {
        run: async () => {
          const execute = jest.fn().mockResolvedValue([
            { name: "react", usage_count: "10" },
            { name: "nodejs", usage_count: "6" }
          ]);
          const repo = createRepositoryAPI(execute);
          const result = await repo.GetPopularTags();
          expect(result).toEqual(["react", "nodejs"]);
          const [sql, params] = execute.mock.calls[0];
          expect(sql).toContain("FROM topics t");
          expect(sql).toContain("LIMIT 25");
          expect(params).toEqual([]);
        }
      },
      {
        run: async () => {
          const execute = jest.fn().mockResolvedValue([]);
          const repo = createRepositoryAPI(execute);
          const result = await repo.GetPopularTags();
          expect(result).toEqual([]);
        }
      },
      {
        run: async () => {
          const execute = jest.fn().mockRejectedValue(new Error("query error"));
          const repo = createRepositoryAPI(execute);
          await expect(repo.GetPopularTags()).rejects.toThrow("query error");
        }
      }
    ];

    for (const testCase of cases) {
      await testCase.run();
    }
  });

  test("GetProcessedRepositoriesCount cases", async () => {
    const cases = [
      {
        run: async () => {
          const execute = jest.fn().mockResolvedValue([{ total: "2" }]);
          const repo = createRepositoryAPI(execute);
          const result = await repo.GetProcessedRepositoriesCount();
          expect(result).toBe(2);
          const [sql, params] = execute.mock.calls[0];
          expect(sql).toContain("SELECT COUNT(*) AS total FROM repositories");
          expect(params).toEqual([]);
        }
      },
      {
        run: async () => {
          const execute = jest.fn().mockResolvedValue([{ total: "0" }]);
          const repo = createRepositoryAPI(execute);
          const result = await repo.GetProcessedRepositoriesCount();
          expect(result).toBe(0);
        }
      },
      {
        run: async () => {
          const execute = jest.fn().mockRejectedValue(new Error("count fail"));
          const repo = createRepositoryAPI(execute);
          await expect(repo.GetProcessedRepositoriesCount()).rejects.toThrow("count fail");
        }
      }
    ];

    for (const testCase of cases) {
      await testCase.run();
    }
  });

  test("GetSupportedSources cases", async () => {
    const cases = [
      {
        run: async () => {
          const execute = jest.fn().mockResolvedValue([{ name: "github" }, { name: "gitlab" }]);
          const repo = createRepositoryAPI(execute);
          const result = await repo.GetSupportedSources();
          expect(result).toEqual(["github", "gitlab"]);
          const [sql, params] = execute.mock.calls[0];
          expect(sql).toContain("SELECT name FROM data_sources");
          expect(params).toEqual([]);
        }
      },
      {
        run: async () => {
          const execute = jest.fn().mockResolvedValue([]);
          const repo = createRepositoryAPI(execute);
          const result = await repo.GetSupportedSources();
          expect(result).toEqual([]);
        }
      },
      {
        run: async () => {
          const execute = jest.fn().mockRejectedValue(new Error("source fail"));
          const repo = createRepositoryAPI(execute);
          await expect(repo.GetSupportedSources()).rejects.toThrow("source fail");
        }
      }
    ];

    for (const testCase of cases) {
      await testCase.run();
    }
  });

  test("GetTagHint cases", async () => {
    const cases = [
      {
        run: async () => {
          const execute = jest.fn().mockResolvedValue([{ name: "react", usage_count: "3" }]);
          const repo = createRepositoryAPI(execute);
          const result = await repo.GetTagHint("Re", ["redux"]);
          expect(result).toEqual([{ name: "react", usage_count: "3" }]);
          const [sql, params] = execute.mock.calls[0];
          expect(sql).toContain("WHERE t.name ILIKE $1");
          expect(sql).toContain("t.name != ALL($3)");
          expect(params).toEqual(["%re%", "re%", ["redux"], 6]);
        }
      },
      {
        run: async () => {
          const execute = jest.fn();
          const repo = createRepositoryAPI(execute);
          const result = await repo.GetTagHint("");
          expect(result).toEqual([]);
          expect(execute).not.toHaveBeenCalled();
        }
      },
      {
        run: async () => {
          const execute = jest.fn().mockRejectedValue(new Error("hint fail"));
          const repo = createRepositoryAPI(execute);
          await expect(repo.GetTagHint("re", [])).rejects.toThrow("hint fail");
        }
      }
    ];

    for (const testCase of cases) {
      await testCase.run();
    }
  });

  test("GetRepositoriesByLib cases", async () => {
    const cases = [
      {
        run: async () => {
          const execute = jest.fn().mockResolvedValue([
            {
              full_name: "owner/repo1",
              stargazers_count: 100,
              contribution_weight: 1,
              insert_date: "2026-01-01",
              total_count: 1
            }
          ]);
          const repo = createRepositoryAPI(execute);
          const result = await repo.GetRepositoriesByLib("react", "javascript", ["github"], 10, 0);
          expect(result).toHaveLength(1);
          const [sql, params] = execute.mock.calls[0];
          expect(sql).toContain("AND ds.name = ANY ($3)");
          expect(sql).toContain("LIMIT $4 OFFSET $5");
          expect(params).toEqual(["react", "javascript", ["github"], 10, 0]);
        }
      },
      {
        run: async () => {
          const execute = jest.fn();
          const repo = createRepositoryAPI(execute);
          const result = await repo.GetRepositoriesByLib("react", "javascript", [], 10, 0);
          expect(result).toEqual([]);
          expect(execute).not.toHaveBeenCalled();
        }
      },
      {
        run: async () => {
          const execute = jest.fn();
          const repo = createRepositoryAPI(execute);
          await expect(repo.GetRepositoriesByLib("react", "", ["github"], 10, 0)).rejects.toThrow("Language is required");
          await expect(repo.GetRepositoriesByLib("", "javascript", ["github"], 10, 0)).rejects.toThrow("Library is required");
          await expect(repo.GetRepositoriesByLib("react", "javascript", null, 10, 0)).rejects.toThrow("Sources are required");
        }
      }
    ];

    for (const testCase of cases) {
      await testCase.run();
    }
  });

  test("GetLibraryMetadata cases", async () => {
    const cases = [
      {
        run: async () => {
          const execute = jest.fn().mockResolvedValue([
            {
              total: 1,
              related_libraries: ["redux"],
              related_topics: ["frontend"]
            }
          ]);
          const repo = createRepositoryAPI(execute);
          const result = await repo.GetLibraryMetadata("React", "JavaScript", ["GitHub"], 7);
          expect(result.total).toBe(1);
          expect(result.related_libraries).toEqual(["redux"]);
          expect(result.related_topics).toEqual(["frontend"]);
          const [sql, params] = execute.mock.calls[0];
          expect(sql).toContain("WITH target_lib AS");
          expect(sql).toContain("ds.name = ANY($3)");
          expect(params).toEqual(["react", "javascript", ["github"], 7]);
        }
      },
      {
        run: async () => {
          const execute = jest.fn().mockResolvedValue([{ total: 0 }]);
          const repo = createRepositoryAPI(execute);
          const result = await repo.GetLibraryMetadata("react", "javascript", ["github"]);
          expect(result).toBeNull();
        }
      },
      {
        run: async () => {
          const execute = jest.fn();
          const repo = createRepositoryAPI(execute);
          await expect(repo.GetLibraryMetadata("react", "javascript", [])).resolves.toBeNull();
          await expect(repo.GetLibraryMetadata("", "javascript", ["github"])).rejects.toThrow("Library is required");
          await expect(repo.GetLibraryMetadata("react", "", ["github"])).rejects.toThrow("Language is required");
          await expect(repo.GetLibraryMetadata("react", "javascript", null)).rejects.toThrow("Sources are required");
        }
      }
    ];

    for (const testCase of cases) {
      await testCase.run();
    }
  });

  test("GetFullRecommendations cases", async () => {
    const cases = [
      {
        run: async () => {
          const execute = jest.fn().mockResolvedValue([
            { name: "redux", total_count: "2" },
            { name: "rxjs", total_count: "2" }
          ]);
          const repo = createRepositoryAPI(execute);
          const result = await repo.GetFullRecommendations(
            "JavaScript",
            ["React"],
            ["Frontend"],
            ["GitHub"],
            10,
            0,
            "re"
          );
          expect(result).toEqual({
            data: [{ name: "redux" }, { name: "rxjs" }],
            total: 2
          });
          const [sql, bindings] = execute.mock.calls[0];
          expect(sql.toLowerCase()).toContain('with "target_repos" as');
          expect(sql.toLowerCase()).toContain("count(*) over() as total_count");
          expect(sql.toLowerCase()).toContain('"l"."name"');
          expect(sql.toLowerCase()).toContain("ilike");
          expect(bindings).toContain("javascript");
          expect(bindings).toContain("react");
          expect(bindings).toContain("frontend");
          expect(bindings).toContain("github");
        }
      },
      {
        run: async () => {
          const execute = jest.fn();
          const repo = createRepositoryAPI(execute);
          const result = await repo.GetFullRecommendations("javascript", [], [], []);
          expect(result).toEqual([]);
          expect(execute).not.toHaveBeenCalled();
        }
      },
      {
        run: async () => {
          const execute = jest.fn().mockRejectedValue(new Error("recommendation fail"));
          const repo = createRepositoryAPI(execute);
          await expect(repo.GetFullRecommendations("", [], [], ["github"]))
            .rejects
            .toThrow("Language is required");
          await expect(repo.GetFullRecommendations("javascript", [], [], ["github"]))
            .rejects
            .toThrow("recommendation fail");
        }
      }
    ];

    for (const testCase of cases) {
      await testCase.run();
    }
  });
});
