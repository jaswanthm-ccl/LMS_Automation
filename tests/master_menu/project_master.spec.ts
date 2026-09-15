import { test, expect } from '../../fixtures/auth.fixture';
import { ProjectMasterPage } from '../../pages/master_menu/project_master.page';
import { getRandomLetters } from '../../utils/common';

test.describe('Project Master Module', () => {
  test('should open the projects list', async ({ page }) => {
    const projectMasterPage = new ProjectMasterPage(page);

    await projectMasterPage.gotoProjectMasterPage();

    await expect(page.getByRole('heading', { name: /Projects List/i })).toBeVisible();
  });

  test('should create, search, view, edit, deactivate, and restore a project', async ({ page }) => {
    const projectMasterPage = new ProjectMasterPage(page);
    const projectName = `project ${getRandomLetters(6)}`;
    const updatedProjectName = `${projectName} updated`;

    await projectMasterPage.gotoProjectMasterPage();
    await projectMasterPage.addProject(projectName);
    await expect(page.getByText('Project created successfully')).toBeVisible();

    await projectMasterPage.searchProject(projectName);
    await expect(projectMasterPage.projectRow(projectName)).toBeVisible();

    await projectMasterPage.viewProject(projectName);
    const viewDialog = page.getByRole('dialog', { name: 'View Project' });
    await expect(viewDialog).toContainText(projectName);
    await viewDialog.getByRole('button', { name: 'Close modal' }).click();

    await projectMasterPage.editProject(projectName, updatedProjectName);
    await expect(page.getByText('Project updated successfully')).toBeVisible();

    await projectMasterPage.searchProject(updatedProjectName);
    await expect(projectMasterPage.projectRow(updatedProjectName)).toBeVisible();
    await projectMasterPage.deactivateProject(updatedProjectName);
    await expect(page.getByText('Project deactivated successfully')).toBeVisible();

    await projectMasterPage.filterByStatus('Inactive');
    await expect(projectMasterPage.projectRow(updatedProjectName)).toBeVisible();
    await projectMasterPage.restoreProject(updatedProjectName);
    await expect(projectMasterPage.projectRow(updatedProjectName)).toBeHidden();

    await projectMasterPage.filterByStatus('Active');
    await expect(projectMasterPage.projectRow(updatedProjectName)).toBeVisible();
  });
});
